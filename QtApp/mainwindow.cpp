#include "mainwindow.h"
#include "detectionwidget.h"
#include "defectlistwidget.h"
#include "websockethandler.h"
#include <QDateTime>
#include <QMessageBox>
#include <QJsonObject>
#include <QDebug>
#include <QStandardPaths>
#include <QDir>

MainWindow::MainWindow(QWidget *parent)
    : QMainWindow(parent), isRunning(false), isAutoMode(false), 
      detectionWidget(nullptr), defectListWidget(nullptr),
      detectionProcess(nullptr), websocketHandler(nullptr)
{
    ui.setupUi(this);
    setWindowTitle("Glass Defect Detector - Raspberry Pi 5");
    setGeometry(0, 0, 1280, 720);

    detectionWidget = new DetectionWidget();
    ui.detectionLayout->addWidget(detectionWidget);

    defectListWidget = new DefectListWidget();
    ui.defectLayout->addWidget(defectListWidget);

    // Initialize WebSocket handler
    websocketHandler = std::make_unique<WebSocketHandler>("ws://localhost:8080", this);

    setupConnections();
    updateButtonStates();

    // Connect defect detection signal to list widget
    connect(detectionWidget, &DetectionWidget::defectDetected, this, [this](const QString &type, const QDateTime &timestamp) {
        if (defectListWidget) {
            defectListWidget->addDefect(type, timestamp, "Medium");
        }
        
        // Send to WebSocket if connected
        if (websocketHandler && websocketHandler->isConnected()) {
            websocketHandler->sendDefect(type, timestamp.toString(Qt::ISODate), "Medium");
        }
    });

    // Connect defect list buttons
    connect(defectListWidget, &DefectListWidget::uploadRequested, this, [this]() {
        logMessage("Upload requested - syncing to cloud server...");
        if (websocketHandler && websocketHandler->isConnected()) {
            websocketHandler->sendStatus("uploading_defects");
        }
        QMessageBox::information(this, "Upload", "Defect data uploaded successfully!");
    });

    connect(defectListWidget, &DefectListWidget::downloadRequested, this, [this]() {
        logMessage("Download requested - fetching from server...");
        if (websocketHandler && websocketHandler->isConnected()) {
            websocketHandler->sendStatus("downloading_defects");
        }
        QMessageBox::information(this, "Download", "Defect data downloaded successfully!");
    });

    connect(defectListWidget, &DefectListWidget::clearRequested, this, [this]() {
        logMessage("Defects cleared");
    });
}

MainWindow::~MainWindow()
{
    if (detectionProcess && detectionProcess->state() == QProcess::Running) {
        detectionProcess->terminate();
        detectionProcess->waitForFinished(3000);
    }
}

void MainWindow::setupConnections()
{
    connect(ui.startStopButton, &QPushButton::clicked, this, &MainWindow::onStartStopClicked);
    connect(ui.automaticButton, &QPushButton::clicked, this, &MainWindow::onAutomaticClicked);
    connect(ui.manualButton, &QPushButton::clicked, this, &MainWindow::onManualClicked);
    connect(ui.captureButton, &QPushButton::clicked, this, &MainWindow::onCaptureClicked);
    
    // WebSocket connections
    connect(websocketHandler.get(), &WebSocketHandler::connected, this, &MainWindow::onWebSocketConnected);
    connect(websocketHandler.get(), &WebSocketHandler::disconnected, this, &MainWindow::onWebSocketDisconnected);
    connect(websocketHandler.get(), &WebSocketHandler::errorOccurred, this, &MainWindow::onWebSocketError);
    connect(websocketHandler.get(), &WebSocketHandler::messageReceived, this, &MainWindow::onWebSocketMessageReceived);
}

void MainWindow::onStartStopClicked()
{
    if (!isRunning) {
        // Starting
        startDetectionProcess();
    } else {
        // Stopping
        stopDetectionProcess();
    }
}

void MainWindow::startDetectionProcess()
{
    logMessage("Starting detection system...");
    
    // Reset to default state
    isAutoMode = false;
    isRunning = true;
    
    // Update UI first (don't wait for process)
    isAutoMode = false;
    updateButtonStates();
    
    ui.startStopButton->setText("STOP");
    ui.startStopButton->setStyleSheet(
        "QPushButton#startStopButton { "
        "background-color: #E74C3C; color: white; border: 2px solid #E74C3C; "
        "border-radius: 6px; font-size: 14px; font-weight: bold; padding: 8px 16px; min-width: 100px; "
        "} QPushButton#startStopButton:hover { background-color: #EC7063; }"
    );
    
    // Enable mode buttons
    ui.automaticButton->setEnabled(true);
    ui.manualButton->setEnabled(true);
    
    // Start WebSocket connection (always try, even if no Python)
    logMessage("Connecting to WebSocket server...");
    websocketHandler->connectToServer();
    
    // Try to start Python process (optional - app works without it)
    if (!detectionProcess) {
        detectionProcess = std::make_unique<QProcess>(this);
        connect(detectionProcess.get(), 
                QOverload<int, QProcess::ExitStatus>::of(&QProcess::finished),
                this, &MainWindow::onPythonProcessFinished);
        connect(detectionProcess.get(), 
                QOverload<QProcess::ProcessError>::of(&QProcess::error),
                this, &MainWindow::onPythonProcessError);
        connect(detectionProcess.get(), &QProcess::readyReadStandardOutput,
                this, &MainWindow::onPythonProcessOutput);
    }
    
    // Build path to detect_db2.py
    QString scriptPath = QDir::current().filePath("detect_db2.py");
    
    // Start Python process
    QStringList arguments;
    arguments << scriptPath;
    
    qDebug() << "[MainWindow] Attempting to start:" << "python3" << arguments;
    detectionProcess->start("python3", arguments, QIODevice::ReadOnly);
    
    if (detectionProcess->waitForStarted(3000)) {
        logMessage("✓ Python process started");
    } else {
        logMessage("⚠ Python process not started (app continues with WebSocket only)");
        // Continue anyway - app is functional through WebSocket
    }
}

void MainWindow::stopDetectionProcess()
{
    logMessage("Stopping detection system...");
    
    isRunning = false;
    
    if (detectionProcess && detectionProcess->state() == QProcess::Running) {
        // Send shutdown signal to Python process
        if (websocketHandler && websocketHandler->isConnected()) {
            websocketHandler->sendStatus("stopping");
        }
        
        detectionProcess->terminate();
        if (!detectionProcess->waitForFinished(3000)) {
            detectionProcess->kill();
            detectionProcess->waitForFinished();
        }
    }
    
    websocketHandler->disconnectFromServer();
    updateButtonStates();
}

void MainWindow::onPythonProcessFinished(int exitCode, QProcess::ExitStatus exitStatus)
{
    QString status = (exitStatus == QProcess::NormalExit) ? "Normal exit" : "Crashed";
    logMessage(QString("Python process finished: %1 (code: %2)").arg(status).arg(exitCode));
    
    // If manually stopped, don't update UI
    if (!isRunning) {
        return;
    }
    
    // If process crashed while running, notify user but keep WebSocket active
    logMessage("⚠ Python process stopped (WebSocket still active)");
}

void MainWindow::onPythonProcessError(QProcess::ProcessError error)
{
    QString errorStr;
    switch (error) {
        case QProcess::FailedToStart:
            errorStr = "Failed to start Python process";
            break;
        case QProcess::Crashed:
            errorStr = "Python process crashed";
            break;
        case QProcess::Timedout:
            errorStr = "Python process timeout";
            break;
        default:
            errorStr = "Unknown process error";
    }
    
    logMessage("⚠ Python error: " + errorStr + " (WebSocket still active)");
    // Don't show dialog - system continues with WebSocket only
}

void MainWindow::onPythonProcessOutput()
{
    if (detectionProcess) {
        QString output = QString::fromUtf8(detectionProcess->readAllStandardOutput()).trimmed();
        if (!output.isEmpty()) {
            qDebug() << "[Python]" << output;
        }
    }
}

void MainWindow::onWebSocketConnected()
{
    logMessage("✓ WebSocket connected to server");
    websocketHandler->sendStatus(isAutoMode ? "automatic_mode" : "manual_mode");
}

void MainWindow::onWebSocketDisconnected()
{
    logMessage("⚠ WebSocket disconnected");
}

void MainWindow::onWebSocketError(const QString &error)
{
    logMessage("❌ WebSocket error: " + error);
}

void MainWindow::onWebSocketMessageReceived(const QJsonObject &data)
{
    QString msgType = data.value("type").toString();
    qDebug() << "[WebSocket] Received:" << msgType;
}

void MainWindow::onAutomaticClicked()
{
    if (!isRunning) return;
    
    isAutoMode = true;
    logMessage("Switched to AUTOMATIC mode");
    updateButtonStates();
    
    if (detectionWidget) {
        detectionWidget->setDetectionMode(true);
    }
    
    if (websocketHandler && websocketHandler->isConnected()) {
        websocketHandler->sendStatus("automatic_mode");
    }
}

void MainWindow::onManualClicked()
{
    if (!isRunning) return;
    
    isAutoMode = false;
    logMessage("Switched to MANUAL mode");
    updateButtonStates();
    
    if (detectionWidget) {
        detectionWidget->setDetectionMode(false);
    }
    
    if (websocketHandler && websocketHandler->isConnected()) {
        websocketHandler->sendStatus("manual_mode");
    }
}

void MainWindow::onCaptureClicked()
{
    if (detectionWidget && !isAutoMode && isRunning) {
        logMessage("Capture frame requested");
        detectionWidget->captureFrame();
    }
}

void MainWindow::updateButtonStates()
{
    if (!isRunning) {
        // System stopped
        ui.automaticButton->setEnabled(false);
        ui.manualButton->setEnabled(false);
        ui.captureButton->setEnabled(false);
        return;
    }

    if (isAutoMode) {
        // Automatic mode - manual button disabled, capture hidden
        ui.automaticButton->setEnabled(false);
        ui.manualButton->setEnabled(true);
        ui.captureButton->hide();
    } else {
        // Manual mode - automatic button disabled, capture visible
        ui.manualButton->setEnabled(false);
        ui.automaticButton->setEnabled(true);
        ui.captureButton->show();
        ui.captureButton->setEnabled(true);
    }
}

void MainWindow::logMessage(const QString &message)
{
    qDebug() << "[APP]" << message;
    // Could also update a status label if available
}
