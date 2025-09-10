// main.js

const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    autoHideMenuBar: true,   // hides menu until Alt is pressed
    // titleBarStyle: 'hidden',
    webPreferences: {
      // preload: path.join(__dirname, 'preload.js'), // optional, if you have a preload file
      nodeIntegration: true, // enable if you want Node.js in renderer
      contextIsolation: false // disable if using nodeIntegration
    }
  });

  // Load the index.html of the app.
  mainWindow.loadFile('index.html');

  // Open the DevTools (optional).
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', function () {
    // On macOS, recreate a window when the dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
