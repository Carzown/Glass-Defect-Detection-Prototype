#ifndef MAINWINDOW_H
#define MAINWINDOW_H

#include <QMainWindow>
#include <QProcess>
#include <QDateTime>
#include <memory>
#include "ui_mainwindow.h"

class DetectionWidget;
class DefectListWidget;
class WebSocketHandler;

class MainWindow : public QMainWindow
{
    Q_OBJECT

public:
    MainWindow(QWidget *parent = nullptr);
    ~MainWindow();

private slots:
    void onStartStopClicked();
    void onAutomaticClicked();
    void onManualClicked();
    void onCaptureClicked();
    
    void onPythonProcessFinished(int exitCode, QProcess::ExitStatus exitStatus);
    void onPythonProcessError(QProcess::ProcessError error);
    void onPythonProcessOutput();
    
    void onWebSocketConnected();
    void onWebSocketDisconnected();
    void onWebSocketError(const QString &error);
    void onWebSocketMessageReceived(const QJsonObject &data);
    
    void updateButtonStates();

private:
    void setupConnections();
    void startDetectionProcess();
    void stopDetectionProcess();
    void logMessage(const QString &message);

    Ui::MainWindow ui;
    bool isRunning;
    bool isAutoMode;
    
    DetectionWidget *detectionWidget;
    DefectListWidget *defectListWidget;
    std::unique_ptr<QProcess> detectionProcess;
    std::unique_ptr<WebSocketHandler> websocketHandler;
};

#endif
