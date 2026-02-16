#include "defectlistwidget.h"
#include <QVBoxLayout>
#include <QLabel>
#include <QDateTime>
#include <QMessageBox>

DefectListWidget::DefectListWidget(QWidget *parent)
    : QWidget(parent), defectCount(0)
{
    setupUI();
    loadDefectsFromStorage();
}

DefectListWidget::~DefectListWidget()
{
}

void DefectListWidget::setupUI()
{
    QVBoxLayout *mainLayout = new QVBoxLayout(this);
    mainLayout->setContentsMargins(0, 0, 0, 0);
    mainLayout->setSpacing(10);

    // Title
    QLabel *titleLabel = new QLabel("Detected Defects", this);
    titleLabel->setStyleSheet("QLabel { color: #D4A048; font-size: 14px; font-weight: bold; }");
    mainLayout->addWidget(titleLabel);

    // Defect list
    defectList = new QListWidget(this);
    defectList->setStyleSheet(
        "QListWidget#defectList { "
        "background-color: #F5F5F5; "
        "border: 2px solid #D4A048; "
        "border-radius: 8px; "
        "padding: 10px; "
        "color: #D4A048; "
        "font-size: 12px; "
        "} "
        "QListWidget::item { "
        "padding: 12px; "
        "margin: 5px 0; "
        "background-color: #EFEFEF; "
        "border-radius: 6px; "
        "border-left: 4px solid #D4A048; "
        "color: #2C3E50; "
        "} "
        "QListWidget::item:hover { background-color: #E8E8E8; } "
        "QListWidget::item:selected { background-color: #DCDCDC; }"
    );
    connect(defectList, &QListWidget::itemClicked, this, &DefectListWidget::onDefectSelected);
    mainLayout->addWidget(defectList);
}

void DefectListWidget::addDefect(const QString &type, const QDateTime &timestamp, const QString &severity, double confidence, const QString &imagePath)
{
    defectCount++;

    QString timeStr = timestamp.toString("HH:mm:ss");
    
    // Format confidence as percentage
    int confidencePercent = static_cast<int>(confidence * 100);
    
    // Create image badge indicator
    QString imageBadge = imagePath.isEmpty() ? "○ Image" : "● Image";
    
    // Display format: [HH:MM:SS] Type | Image Badge | Confidence%
    QString displayText = QString("[%1] %2 | %3 | %4%")
                              .arg(timeStr)
                              .arg(type)
                              .arg(imageBadge)
                              .arg(confidencePercent);

    QListWidgetItem *item = new QListWidgetItem(displayText);
    item->setData(Qt::UserRole, type);
    item->setData(Qt::UserRole + 1, timestamp.toString(Qt::ISODate));
    item->setData(Qt::UserRole + 2, imagePath);
    item->setData(Qt::UserRole + 3, confidence);
    defectList->insertItem(0, item);
}

void DefectListWidget::clearDefects()
{
    defectList->clear();
    defectCount = 0;
}

int DefectListWidget::getDefectCount() const
{
    return defectCount;
}

void DefectListWidget::onDefectSelected(QListWidgetItem *item)
{
    QString type = item->data(Qt::UserRole).toString();
    QString timestamp = item->data(Qt::UserRole + 1).toString();
    QString imagePath = item->data(Qt::UserRole + 2).toString();
    double confidence = item->data(Qt::UserRole + 3).toDouble();
    int confidencePercent = static_cast<int>(confidence * 100);
    
    QString details = QString("Type: %1\nTimestamp: %2\nConfidence: %3%\nImage: %4")
                          .arg(type, timestamp, QString::number(confidencePercent), 
                               imagePath.isEmpty() ? "No image" : "Available");
    
    QMessageBox::information(this, "Defect Details", details);
}

void DefectListWidget::loadDefectsFromStorage()
{
    // Placeholder for loading defects from local storage or database
    // This would be connected to the backend
}
