#ifndef DETECTIONWIDGET_H
#define DETECTIONWIDGET_H

#include <QWidget>
#include <QLabel>
#include <QImage>
#include <QPixmap>
#include <QPushButton>
#include <QDateTime>

class DetectionWidget : public QWidget
{
    Q_OBJECT

public:
    explicit DetectionWidget(QWidget *parent = nullptr);
    ~DetectionWidget();

    void setDetectionMode(bool autoMode);
    void displayImage(const QPixmap &pixmap);
    void displayPlaceholder();
    void captureFrame();

signals:
    void defectDetected(const QString &type, const QDateTime &timestamp);
    void frameUpdated(const QPixmap &pixmap);

private slots:
    void onCaptureClicked();
    void onSimulateDetection();

private:
    void setupUI();
    void setupSimulation();

    QLabel *previewLabel;
    QPushButton *captureButton;
    QPixmap currentImage;
    bool isAutoMode;
};

#endif // DETECTIONWIDGET_H
