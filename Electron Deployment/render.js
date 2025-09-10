
const XLSX = require('xlsx');
const { Chart, registerables } = require('chart.js');
// const ChartDataLabels = require('chartjs-plugin-datalabels');
Chart.register(...registerables);
// Chart.register(ChartDataLabels);
const FILTER_CONFIGS = [
  { id: "select-clientName", name: "Client", placeholder: "Tous les clients", dropDownId: "div-Client-dropDown" },
  { id: "select-Comercial", name: "Commercial", placeholder: "Tous les commerciaux", dropDownId: "div-Commercial-dropDown" },
  { id: "select-Service", name: "Service", placeholder: "Tous les services", dropDownId: "div-Service-dropDown" },
  { id: "select-Dossier", name: "Dossier", placeholder: "Tous les dossiers", dropDownId: "div-Dossier-dropDown" },
  { id: "select-FromDate", name: "Date de facturation", placeholder: "", dropDownId: "" }
];

let originalData = [];
let chartInstance = null;
let allCanvasArray = [];
document.addEventListener('DOMContentLoaded', initialize);

function displayAdditionalInfo(data) {
  let CATotal = document.getElementById("ca-total");
  let TopCommercialByName = document.getElementById("top-commercial-name");
  let CaParServiceElement = document.getElementById("service-breakdown");

  CATotal.innerHTML = "";
  TopCommercialByName.innerHTML = "";
  CaParServiceElement.innerHTML = '<div class="kpi-subtitle">Aucune donnée disponible</div>';


  let TotalCa = calculateTotalCA(data);
  let formatedTotalCa = formatCurrency(TotalCa);

  let TopCommercialObj = calculateTopCommercial(data);
  let topCommercialName = TopCommercialObj.name;
  let topCommercialAmount = formatCurrency(TopCommercialObj.amount);
  CATotal.innerText = formatedTotalCa;
  TopCommercialByName.innerHTML = `<p style="padding-left:10px">${topCommercialName}</p><p class="p-topcommercial-amount">${topCommercialAmount}</p>`;
  let caByService = calculateCAByService(data);
  if (caByService.length) {
    CaParServiceElement.innerHTML = "";
    caByService.forEach(element => {
      CaParServiceElement.innerHTML += `<p><span class="span-Service">${element[0]}: </span><span class="span-serviceValue">${formatCurrency(element[1])}</span></p>`
    });
  }
}

function calculateTotalCA(data) {
  return data.reduce((sum, item) => sum + (item["CA EN DH"] || 0), 0);
}

function calculateCAByService(data) {
  const serviceCA = {};
  data.forEach(item => {
    const service = item["Service"] || "Unknown";
    const ca = item["CA EN DH"] || 0;
    serviceCA[service] = (serviceCA[service] || 0) + ca;
  });
  return Object.entries(serviceCA)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
}

function calculateTopCommercial(data) {
  const commercialCA = {};
  let counter = 0;
  data.forEach(item => {
    counter++;
    if (item["Commercial"] && item["Commercial"].length) {
      const commercial = item["Commercial"] || "Unknown";
      const ca = item["CA EN DH"] || 0;
      commercialCA[commercial] = (commercialCA[commercial] || 0) + ca;
    }
  });

  const topCommercial = Object.entries(commercialCA)
    .sort((a, b) => b[1] - a[1])[0];

  return topCommercial ? { name: topCommercial[0], amount: topCommercial[1] } : { name: "-", amount: 0 };
}

function formatCurrency(amount) {
  let fixed = amount.toFixed(3);
  fixed = fixed.replaceAll(".", "");

  let newAmount = "";
  for (let i = fixed.length - 1, count = 0; i >= 0; i--, count++) {
    newAmount = fixed[i] + newAmount;
    if (i === fixed.length - 3) newAmount = "," + newAmount;
    else if (count % 3 === 2 && i !== 0) {
      newAmount = "." + newAmount;
    }
  }

  return newAmount + " DH";
}

function loadDataIntoDivs(data) {
  FILTER_CONFIGS.forEach(filterElement => {
    let filterElementDiv = document.getElementById(filterElement.dropDownId);
    if (filterElementDiv != null) filterElementDiv.innerHTML = "";
  });

  data.forEach(row => {
    FILTER_CONFIGS.forEach(filterElement => {
      if (filterElement.dropDownId.length) {
        let filterElementDiv = document.getElementById(filterElement.dropDownId);
        let otherDivs = document.querySelector(`.div-FilterDataElement[value="${row[filterElement.name]}"]`);
        if (otherDivs == null && row[filterElement.name] && row[filterElement.name].trim() != "") {
          let filterElementDiv = document.getElementById(filterElement.dropDownId);
          let FilterDataElement = document.createElement("div");
          FilterDataElement.className = "div-FilterDataElement";
          FilterDataElement.setAttribute("value", row[filterElement.name]);
          FilterDataElement.innerText = row[filterElement.name];
          FilterDataElement.addEventListener("mousedown", () => {
            let InputElement = document.getElementById(filterElement.id);
            InputElement.value = row[filterElement.name];
          });
          filterElementDiv.appendChild(FilterDataElement);
        }
      }
    });
  });
}

function destroyChart() {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
}

function groupBy(data, groupLabel) {
  let values = [];

  data.filter(obj => {
    let searched = values.filter(value => value.label == obj[groupLabel])

    if (searched.length) {
      values[values.indexOf(searched[0])].amount += parseFloat(obj["CA EN DH"]);
    } else {
      values.push({ "label": obj[groupLabel], amount: 0 });
    }
  });
  return values;
}

function createChart(data, excludeFilters = []) {
  displayAdditionalInfo(data);
  destroyChart();

  const graphContainer = document.getElementById("div-graph");
  let SelectParameter = document.getElementById("select-inRelationOf");
  let selectedGraphType = document.getElementById("select-graphType").value;

  graphContainer.innerHTML = "";
  graphContainer.style.cssText = `
    background: #ffffff;
    border: 1px solid rgba(226, 232, 240, 0.8);
    border-radius: 16px;
    padding: 2rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
                0 2px 4px -1px rgba(0, 0, 0, 0.06),
                0 0 0 1px rgba(255, 255, 255, 0.5);
    position: relative;
    overflow: hidden;
    margin: 1rem 0;
  `;

  const dashboardColors = {
    primary: '#0056b3', // Dark Blue
    secondary: '#36a2eb', // Sky Blue
    accent: '#ff6384', // Rose
    light: '#e9ecef', // Light Gray
    success: '#28a745', // Green
    warning: '#ffc107', // Yellow
    info: '#17a2b8', // Teal
    danger: '#dc3545', // Red
    dark: '#343a40', // Dark Gray
    muted: '#6c757d' // Muted Gray
  };

  const getDashboardColors = (count) => {
    const colorSequence = [
      dashboardColors.primary,
      dashboardColors.secondary,
      dashboardColors.info,
      dashboardColors.success,
      dashboardColors.warning,
      dashboardColors.danger,
      dashboardColors.dark,
      dashboardColors.muted,
      dashboardColors.accent
    ];

    const result = [];
    for (let i = 0; i < count; i++) {
      result.push(colorSequence[i % colorSequence.length]);
    }
    return result;
  };

  let labels;
  let values;
  let chartType;

  Array.from(SelectParameter.children).forEach(Option => {
    let optionValue = Option.value;
    if (optionValue != "all") {
      let excludeFiltersCopy = structuredClone(excludeFilters);
      if (optionValue == "all in one") {
        labels = generateLabels(data, excludeFilters);
        values = data.map(item => item["CA EN DH"] || 0);
        chartType = selectedGraphType;
      } else {
        let GroupedData = groupBy(data, optionValue);
        values = GroupedData.map(element => element.amount);
        labels = GroupedData.map(element => element.label);
        chartType = selectedGraphType;
      }

      labels = labels.map(element => element == undefined || element.toString().trim().length == 0 ? "Unknown" : element);

      const h_canvasTitle = document.createElement("h1");
      const canvas = document.createElement("canvas");

      h_canvasTitle.innerText = optionValue;
      h_canvasTitle.style.cssText = `
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 1.875rem;
        font-weight: 700;
        text-align: center;
        margin: 1.5rem 0;
        letter-spacing: -0.025em;
        display: none;
        position: relative;
        z-index: 1;
      `;

      h_canvasTitle.id = `graph-${optionValue.replaceAll(" ", "-")}`;
      canvas.id = `graph-${optionValue.replaceAll(" ", "-")}`;
      canvas.className = "graph";
      canvas.style.cssText = `
        display: none;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.8);
        position: relative;
        z-index: 1;
      `;

      allCanvasArray.push(h_canvasTitle);
      allCanvasArray.push(canvas);
      graphContainer.appendChild(h_canvasTitle);
      graphContainer.appendChild(canvas);

      const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'nearest'
        },
        animation: false,
        layout: {
          padding: 20
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              font: {
                family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                size: 13,
                weight: '500'
              },
              color: '#374151',
              padding: 15,
              usePointStyle: true
            }
          },
          tooltip: {
            backgroundColor: 'rgba(17, 24, 39, 0.95)',
            titleColor: '#ffffff',
            bodyColor: '#f3f4f6',
            borderColor: dashboardColors.primary,
            borderWidth: 2,
            cornerRadius: 8,
            padding: 12,
            titleFont: {
              family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              size: 13,
              weight: '600'
            },
            bodyFont: {
              family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              size: 12,
              weight: '400'
            }
          }
        }
      };

      const chartConfig = {
        type: chartType,
        data: {
          labels: labels,
          datasets: [{
            label: "CA EN DH",
            data: values,
            backgroundColor: getDashboardColors(values.length).map(color => color + 'cc'),
            borderColor: getDashboardColors(values.length).map(color => color),
            borderWidth: 5
          }]
        },
        options: commonOptions
      };

      // Custom options based on chart type
      if (chartType === 'doughnut' || chartType === 'pie') {
        chartConfig.options.layout.padding = 50;
        chartConfig.data.datasets[0].backgroundColor = getDashboardColors(values.length).map(color => color + 'cc');
        chartConfig.data.datasets[0].borderColor = getDashboardColors(values.length).map(color => color);
        chartConfig.data.datasets[0].borderWidth = 2;
        chartConfig.data.datasets[0].hoverOffset = 10;
        chartConfig.options.plugins.legend.position = 'bottom';
        chartConfig.options.plugins.legend.labels = {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 25,
          font: {
            family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            size: 13,
            weight: '500'
          },
          color: '#374151',
          boxWidth: 12,
          boxHeight: 12,
          generateLabels: function(chart) {
            const data = chart.data;
            if (data.labels.length && data.datasets.length) {
              const total = values.reduce((sum, value) => sum + value, 0);
              return data.labels.map((label, i) => {
                const dataset = data.datasets[0];
                const value = dataset.data[i];
                const percentage = ((value / total) * 100).toFixed(1);
                return {
                  text: `${label} (${percentage}%)`,
                  fillStyle: getDashboardColors(values.length)[i % getDashboardColors(values.length).length],
                  strokeStyle: getDashboardColors(values.length)[i % getDashboardColors(values.length).length],
                  lineWidth: 2,
                  hidden: false,
                  index: i
                };
              });
            }
            return [];
          }
        };
        chartConfig.options.plugins.tooltip.callbacks = {
          label: function(context) {
            const value = context.parsed;
            const total = values.reduce((sum, val) => sum + val, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `Montant: ${formatCurrency(value)} (${percentage}%)`;
          }
        };

        if (chartType === 'doughnut') {
          chartConfig.data.datasets[0].cutout = '68%';
          chartConfig.data.datasets[0].borderRadius = 10; // Add this line
          chartConfig.plugins = [{
            id: 'centerText',
            beforeDraw: function(chart) {
              const ctx = chart.ctx;
              const centerX = chart.chartArea.left + (chart.chartArea.right - chart.chartArea.left) / 2;
              const centerY = chart.chartArea.top + (chart.chartArea.bottom - chart.chartArea.top) / 2;
              const total = values.reduce((sum, val) => sum + val, 0);
              ctx.save();
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillStyle = dashboardColors.primary;
              ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
              ctx.fillText(formatCurrency(total), centerX, centerY - 10);
              ctx.fillStyle = '#6b7280';
              ctx.font = '500 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
              ctx.fillText('Total', centerX, centerY + 16);
              ctx.restore();
            }
          }];
        }
      } else if (chartType === 'line') {
        chartConfig.data.datasets[0].fill = true;
        chartConfig.data.datasets[0].tension = 0.4;
        chartConfig.data.datasets[0].pointBackgroundColor = '#ffffff';
        chartConfig.data.datasets[0].pointBorderColor = dashboardColors.primary;
        chartConfig.data.datasets[0].pointBorderWidth = 3;
        chartConfig.data.datasets[0].pointRadius = 5;
        chartConfig.data.datasets[0].pointHoverRadius = 8;
        chartConfig.data.datasets[0].pointHoverBackgroundColor = dashboardColors.primary;
        chartConfig.data.datasets[0].pointHoverBorderColor = '#ffffff';
        chartConfig.data.datasets[0].pointHoverBorderWidth = 3;
        chartConfig.data.datasets[0].backgroundColor = (context) => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return null;
          const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
          gradient.addColorStop(0, dashboardColors.primary + '10');
          gradient.addColorStop(0.5, dashboardColors.primary + '30');
          gradient.addColorStop(1, dashboardColors.primary + '60');
          return gradient;
        };
        chartConfig.options.scales = {
          x: {
            grid: {
              color: 'rgba(229, 231, 235, 0.8)',
              lineWidth: 1
            },
            ticks: {
              font: {
                family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                size: 12,
                weight: '400'
              },
              color: '#6b7280'
            }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(229, 231, 235, 0.8)',
              lineWidth: 1
            },
            ticks: {
              font: {
                family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                size: 12,
                weight: '400'
              },
              color: '#6b7280',
              callback: function(value) {
                return formatCurrency(value);
              }
            }
          }
        };
        chartConfig.options.plugins.tooltip.callbacks = {
          title: function(context) {
            return `📅 ${context[0].label}`;
          },
          label: function(context) {
            return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
          }
        };
      } else if (chartType === 'bar' || chartType === 'radar' || chartType === 'polarArea' || chartType === 'bar-h') {
        chartConfig.data.datasets[0].borderRadius = 6;
        chartConfig.data.datasets[0].borderSkipped = false;
        chartConfig.data.datasets[0].hoverBorderWidth = 3;
        chartConfig.options.scales = {
          x: {
            beginAtZero: true,
            grid: {
              color: 'rgba(229, 231, 235, 0.8)',
              lineWidth: 1
            },
            ticks: {
              font: {
                family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                size: 12,
                weight: '400'
              },
              color: '#6b7280'
            }
          },
          y: {
            grid: {
              color: 'rgba(229, 231, 235, 0.8)',
              lineWidth: 1
            },
            ticks: {
              font: {
                family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                size: 12,
                weight: '400'
              },
              color: '#6b7280'
            }
          }
        };
        if(chartType === 'bar') {
          chartConfig.options.indexAxis = "x";
          chartConfig.options.plugins.tooltip.callbacks = {
            label: function(context) {
              return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
            }
          };
        } else if (chartType === 'bar-h') {
            chartConfig.options.indexAxis = 'y';
            chartConfig.options.plugins.tooltip.callbacks = {
              label: function(context) {
                return `${context.dataset.label}: ${formatCurrency(context.parsed.x)}`;
              }
            };
            chartType = 'bar';
            chartConfig.type = chartType;
            chartConfig.options.scales.x.ticks.callback = function(value) {
              return formatCurrency(value);
            };
            chartConfig.options.scales.y.ticks.display = true;
        } else {
          chartConfig.options.plugins.tooltip.callbacks = {
            label: function(context) {
              return `${context.dataset.label}: ${formatCurrency(context.parsed.r)}`;
            }
          };
        }
      }

      chartInstance = new Chart(canvas, chartConfig);
    }
  });

  controllCanvasDisplay();
}

function generateColors(count) {
  const colors = [];
  for (let i = 0; i < count; i++) {
    const hue = Math.floor((360 / count) * i);
    colors.push(`${hue}`);
  }
  return colors;
}

function controllCanvasDisplay() {
  let SelectParameter = document.getElementById("select-inRelationOf");
  allCanvasArray.forEach(canvas => { canvas.style.display = "none" });
  if (SelectParameter.value == "all") {
    allCanvasArray.forEach(canvas => { if (canvas.id != "graph-all-in-one") canvas.style.display = "block" });
  } else {
    let canvas = document.querySelectorAll(`#graph-${SelectParameter.value.replaceAll(" ", "-")}`);
    canvas.forEach(element => { element.style.display = "block" });
  }
}

function generateLabels(data, excludeFilters) {
  const includeFilters = FILTER_CONFIGS
    .map(config => config.name)
    .filter(name => !excludeFilters.includes(name));

  return data.map(item => {
    let labelParts = includeFilters
      .map(filter => item[filter] || "Unknown")
      .filter(value => value.toString().trim());
    labelParts = labelParts.map(element => element.length > 10 ? element.slice(0, 10) + "..." : element);
    return labelParts.join(" | ") || "No Data";
  });
}

function showNoDataMessage() {
  destroyChart();

  const graphContainer = document.getElementById("div-graph");
  graphContainer.innerHTML = `
    <div style="text-align: center; color: #6b7280; padding: 2rem;">
      <div style="font-size: 3rem; margin-bottom: 1rem;">📈</div>
      <h3 style="margin-bottom: 0.5rem; color: #374151;">Aucune donnée disponible</h3>
      <p>Aucun Résultat Correspondant Aux Filtres Sélectionnés.</p>
    </div>
  `;
}

function createChartUsingFilters() {
  let filters = [];
  let timeSegment = false;

  let filteredData = originalData;
  let editedFilters = structuredClone(FILTER_CONFIGS);

  let FromDateInput = document.getElementById("select-FromDate");
  let ToDateInput = document.getElementById("select-ToDate");

  if (FromDateInput.value.trim() != "" && ToDateInput.value.trim() != "" && ToDateInput.value != FromDateInput.value) {
    editedFilters.pop();
    timeSegment = true;
  }
  else if (FromDateInput.value.trim() == "" && ToDateInput.value.trim() != "" || (ToDateInput.value.trim() != "" && ToDateInput.value == FromDateInput.value)) {
    FromDateInput.value = ToDateInput.value;
  }

  editedFilters.forEach(filter => {
    let filterInput = document.getElementById(filter.id);
    if (filterInput.value != "Selectionner Tous" && filterInput.value.trim() != "") {
      if (filter.name == "Date de facturation") {
        filteredData = filteredData.filter(row => Date.parse(filterInput.value) == Date.parse(formateDate(row[filter.name])));
      } else {
        filteredData = filteredData.filter(row => filterInput.value == row[filter.name]);
      }
      filters.push(filter.name);
    }
  });


  if (timeSegment) {
    filteredData = filteredData.filter(row => Date.parse(FromDateInput.value) <= Date.parse(formateDate(row["Date de facturation"])) && Date.parse(formateDate(row["Date de facturation"])) <= Date.parse(ToDateInput.value));
  }

  if (filteredData.length) createChart(filteredData, filters);
  else showNoDataMessage();
}

function formateDate(date) {
  let ArrayDate = date.split("-");
  return `${ArrayDate[2]}-${ArrayDate[1]}-${ArrayDate[0]}`;
}

function resetFilters() {
  FILTER_CONFIGS.forEach(element => { document.getElementById(element.id).value = "" });
  document.getElementById("select-ToDate").value = "";
  document.getElementById("select-inRelationOf").value = "all";
  // document.getElementById("select-graphType").value = "bar";
  if (originalData.length) createChart(originalData);
  else showNoDataMessage();
}

function handleFileUpload(file) {
  // document.body.style.opacity = 0;
  const reader = new FileReader();

  reader.onload = function(event) {
    const workbook = XLSX.read(event.target.result, { type: "binary" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

    originalData = XLSX.utils.sheet_to_json(firstSheet);

    if (originalData.length > 0) {
      setupEventListeners(originalData);
      loadDataIntoDivs(originalData);
      createChart(originalData, []);
    }
  };

  reader.readAsBinaryString(file);
  resetFilters();
  document.getElementById("select-graphType").value = "bar";
}

function handleNewFiles(file){
    let newFileDiv = document.createElement("div");
    newFileDiv.innerText = file.name;
    newFileDiv.className="newFileDiv";
    let deleteFileButton = document.createElement("button");

    deleteFileButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg> `
      deleteFileButton.className="deleteFileButton";

    deleteFileButton.className = "deleteFileButton";
    deleteFileButton.addEventListener("click", () => {
      const currentDiv = deleteFileButton.parentElement; // store current element
      const prev = currentDiv.previousElementSibling;    // get previous before removal
      const next = currentDiv.nextElementSibling;        // get next before removal

      currentDiv.remove();
      
      if (prev && prev.className != "upload-section") {
        prev.click();
        document.querySelectorAll(".newFileDiv").forEach(element => element.removeAttribute("style"));
        prev.style.borderColor = "#4f6f96"; 
        showNotification("Un Nouveau Fichier A Été Chargé");
      } else if (next && next.className != "upload-section") {
        next.click();
        document.querySelectorAll(".newFileDiv").forEach(element => element.removeAttribute("style"));
        next.style.borderColor = "#4f6f96";
        showNotification("Un Nouveau Fichier A Été Chargé");
      } else {
        window.location.reload(); // if no other element exists, reload
      }
    });


    newFileDiv.appendChild(deleteFileButton);

    document.querySelectorAll(".newFileDiv").forEach(element => element.removeAttribute("style"));
    newFileDiv.style.borderColor = "#4f6f96";
    showNotification("Un Nouveau Fichier A Été Chargé");
    newFileDiv.addEventListener("click",()=>{
      document.querySelectorAll(".newFileDiv").forEach(element => element.removeAttribute("style"));
      newFileDiv.style.borderColor = "#4f6f96"; 
      showNotification("Un Nouveau Fichier A Été Chargé");
      handleFileUpload(file);
    });

    let  topDivContainer =  document.querySelector("#topDivContainer");
    topDivContainer.appendChild(newFileDiv);
  }


function initialize() {
  const fileInput = document.getElementById("upload");
  const addFileBtn = document.getElementById("add-file-btn");

  // Add file button functionality
  if(addFileBtn){
    addFileBtn.addEventListener("click", function() {
      fileInput.click();
    });
  }
  fileInput.addEventListener("change", function(event) {
    const file = event.target.files[0];
    if (file) {
      if (file.name.split(".")[file.name.split(".").length - 1].toLowerCase() == "xls" || file.name.split(".")[file.name.split(".").length - 1].toLowerCase() == "xlsx") {
        handleNewFiles(file)
        handleFileUpload(file);
      }
    }
    // Clear the input so the same file can be uploaded again
    fileInput.value = '';
  });

}

function addFileToList(fileObject) {
  const fileList = document.getElementById("file-list");
  
  const fileItem = document.createElement("div");
  fileItem.className = "file-item";
  fileItem.dataset.fileId = fileObject.id;
  
  const fileName = document.createElement("span");
  fileName.textContent = fileObject.name;
  
  const deleteBtn = document.createElement("button");
  deleteBtn.className = "file-delete-btn";
  deleteBtn.innerHTML = "×";
  deleteBtn.onclick = function(e) {
    e.stopPropagation();
    deleteFile(fileObject.id);
  };
  
  fileItem.appendChild(deleteBtn);
  fileItem.appendChild(fileName);
  
  fileItem.onclick = function() {
    loadFile(fileObject.id);
  };
  
  fileList.appendChild(fileItem);
}

function loadFile(fileId) {
  const fileObject = uploadedFiles.find(f => f.id === fileId);
  if (!fileObject) return;
  
  currentFileId = fileId;
  originalData = fileObject.data;
  
  // Update active file styling
  document.querySelectorAll('.file-item').forEach(item => {
    item.classList.remove('active');
  });
  document.querySelector(`[data-file-id="${fileId}"]`).classList.add('active');
  
  if (originalData.length > 0) {
    setupEventListeners(originalData);
    loadDataIntoDivs(originalData);
    createChart(originalData, []);
  }
}

function deleteFile(fileId) {
  // Remove from uploadedFiles array
  uploadedFiles = uploadedFiles.filter(f => f.id !== fileId);
  
  // Remove from DOM
  const fileItem = document.querySelector(`[data-file-id="${fileId}"]`);
  if (fileItem) {
    fileItem.remove();
  }
  
  // If deleted file was currently displayed, clear the graph
  if (currentFileId === fileId) {
    currentFileId = null;
    originalData = [];
    showNoDataMessage();
    
    // Clear KPI displays
    document.getElementById("ca-total").innerText = "0 DH";
    document.getElementById("top-commercial-name").innerText = "-";
    document.getElementById("service-breakdown").innerHTML = '<div class="kpi-subtitle">Aucune donnÃ©e disponible</div>';
    
    // Show upload section if no files remain
    if (uploadedFiles.length === 0) {
      document.getElementsByClassName("upload-section")[0].style.display = "flex";
    }
  }
}
function setupEventListeners(data) {
  FILTER_CONFIGS.forEach(filterElement => {
    let filterElementDiv = document.getElementById(filterElement.dropDownId);
    if (filterElementDiv != null) {
      let inputFilterElement = document.getElementById(filterElement.id);
      inputFilterElement.addEventListener("input", () => {
        syncSearch(filterElementDiv, inputFilterElement, filterElement);
      });

      inputFilterElement.addEventListener("focus", () => {
        let dropDownElement = document.getElementById(filterElement.dropDownId);
        dropDownElement.style.display = "block";
        syncSearch(filterElementDiv, inputFilterElement, filterElement);
      });

      inputFilterElement.addEventListener("blur", () => {
        let dropDownElement = document.getElementById(filterElement.dropDownId);
        dropDownElement.style.display = "none";
      });
    }
  });
}

function syncSearch(filterElementDiv, inputFilterElement, filterElement) {
  let noFilterValueWasFoundElement = filterElementDiv.querySelector(".div-noFilterValueWasFound");
  if (noFilterValueWasFoundElement) noFilterValueWasFoundElement.remove();

  let valueElemnents = filterElementDiv.querySelectorAll("div[value]");
  valueElemnents.forEach(element => {
    if (element.getAttribute("value").toLowerCase().includes(inputFilterElement.value.toLowerCase())) element.style.display = "block";
    else element.style.display = "none";
  });
  if (!filterElementDiv.innerText.length) {
    noFilterValueWasFoundElement = document.createElement("div");
    noFilterValueWasFoundElement.className = "div-noFilterValueWasFound";
    noFilterValueWasFoundElement.innerText = `Cannot Found A ${filterElement.name} Named: ${inputFilterElement.value}`
    filterElementDiv.appendChild(noFilterValueWasFoundElement);
  }
}


function clearInput(button) {
  let parentDiv = button.parentElement;
  let inputElement = parentDiv.querySelector("input");
  inputElement.value = "";
  inputElement.focus();
}


document.getElementById("select-inRelationOf").addEventListener("change", createChartUsingFilters);
document.getElementById("select-graphType").addEventListener("change", createChartUsingFilters);

function showNotification(message, duration = 3000) {
    const notification = document.createElement('div');
    notification.classList.add('notification');
    notification.textContent = message;
    document.body.appendChild(notification);

    // Trigger animation
    requestAnimationFrame(() => {
        notification.classList.add('show');
    });

    // Remove after duration
    setTimeout(() => {
        notification.classList.remove('show');
        notification.addEventListener('transitionend', () => {
            notification.remove();
        });
    }, duration);
}


document.querySelectorAll(".newFileDiv").forEach(ele=>{
  ele.addEventListener("click",()=>{
  });
});

