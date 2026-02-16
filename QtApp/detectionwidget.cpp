#include "detectionwidget.h"
#include <QVBoxLayout>
#include <QDateTime>
#include <QTimer>
#include <QRandomGenerator>
#include <QPainter>

DetectionWidget::DetectionWidget(QWidget *parent)
    : QWidget(parent), isAutoMode(false)
{
    setupUI();
    setupSimulation();
}

DetectionWidget::~DetectionWidget()
{
}

void DetectionWidget::setupUI()
{
    QVBoxLayout *layout = new QVBoxLayout(this);
    layout->setContentsMargins(0, 0, 0, 0);
    layout->setSpacing(10);

    previewLabel = new QLabel(this);
    previewLabel->setMinimumHeight(600);
    previewLabel->setAlignment(Qt::AlignCenter);
    previewLabel->setStyleSheet("QLabel { background-color: #E8E8E8; border: 2px solid #D4A048; border-radius: 8px; }");
    layout->addWidget(previewLabel);

    captureButton = new QPushButton("Capture Frame", this);
    captureButton->setStyleSheet(
        "QPushButton { "
        "background-color: #D4A048; "
        "color: white; "
        "border: 2px solid #D4A048; "
        "border-radius: 6px; "
        "font-size: 12px; "
        "font-weight: bold; "
        "padding: 8px 16px; "
        "} "
        "QPushButton:hover { background-color: #E5B759; } "
        "QPushButton:pressed { background-color: #C4941F; }"
    );
    connect(captureButton, &QPushButton::clicked, this, &DetectionWidget::onCaptureClicked);
    layout->addWidget(captureButton);

    displayPlaceholder();
}

void DetectionWidget::setupSimulation()
{
    // Simulate detection in automatic mode
    QTimer *simulationTimer = new QTimer(this);
    connect(simulationTimer, &QTimer::timeout, this, &DetectionWidget::onSimulateDetection);
    simulationTimer->start(5000); // Simulate every 5 seconds
}

void DetectionWidget::setDetectionMode(bool autoMode)
{
    isAutoMode = autoMode;
    if (autoMode) {
        captureButton->setText("Auto-detecting...");
        captureButton->setEnabled(false);
    } else {
        captureButton->setText("Capture Frame");
        captureButton->setEnabled(true);
    }
}

void DetectionWidget::displayImage(const QPixmap &pixmap)
{
    currentImage = pixmap;
    QPixmap scaledPixmap = pixmap.scaledToWidth(previewLabel->width() - 10, Qt::SmoothTransformation);
    previewLabel->setPixmap(scaledPixmap);
}

void DetectionWidget::displayPlaceholder()
{
    QPixmap placeholder(previewLabel->width() - 10, previewLabel->height() - 10);
    placeholder.fill(Qt::lightGray);

    QPainter painter(&placeholder);
    painter.setPen(Qt::gray);
    painter.setFont(QFont("Arial", 14));
    painter.drawText(placeholder.rect(), Qt::AlignCenter, "Detection Preview\n\nNo image loaded");
    painter.end();

    previewLabel->setPixmap(placeholder);
}

void DetectionWidget::captureFrame()
{
    onCaptureClicked();
}

void DetectionWidget::onCaptureClicked()
{
    // Generate a test image
    QPixmap testImage(640, 480);
    testImage.fill(Qt::white);

    QPainter painter(&testImage);
    painter.fillRect(100, 100, 150, 150, Qt::lightGray);
    painter.drawRect(100, 100, 150, 150);
    painter.setPen(Qt::red);
    painter.drawRect(120, 120, 100, 100); // Detected defect area
    painter.drawText(130, 140, "Defect");
    painter.end();

    displayImage(testImage);

    // Emit detection signal randomly
    if (QRandomGenerator::global()->bounded(100) < 60) {
        QStringList defectTypes = {"Scratch", "Crack", "Bubble", "Discoloration"};
        QString type = defectTypes[QRandomGenerator::global()->bounded(defectTypes.size())];
        double confidence = 0.75 + (QRandomGenerator::global()->bounded(100) / 500.0); // 0.75-0.95
        emit defectDetected(type, QDateTime::currentDateTime(), confidence, "");
    }
}

void DetectionWidget::onSimulateDetection()
{
    if (isAutoMode) {
        onCaptureClicked();
    }
}
