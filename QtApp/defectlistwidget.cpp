#include "defectlistwidget.h"
#include <QVBoxLayout>
#include <QHBoxLayout>
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

    // Buttons layout
    QHBoxLayout *buttonLayout = new QHBoxLayout();
    buttonLayout->setSpacing(10);

    uploadButton = new QPushButton("Upload", this);
    uploadButton->setStyleSheet(
        "QPushButton { "
        "background-color: #D4A048; "
        "color: white; "
        "border: 2px solid #D4A048; "
        "border-radius: 6px; "
        "font-size: 11px; "
        "font-weight: bold; "
        "padding: 6px 12px; "
        "} "
        "QPushButton:hover { background-color: #E5B759; } "
        "QPushButton:pressed { background-color: #C4941F; }"
    );
    connect(uploadButton, &QPushButton::clicked, this, &DefectListWidget::onUploadClicked);
    buttonLayout->addWidget(uploadButton);

    downloadButton = new QPushButton("Download", this);
    downloadButton->setStyleSheet(
        "QPushButton { "
        "background-color: #D4A048; "
        "color: white; "
        "border: 2px solid #D4A048; "
        "border-radius: 6px; "
        "font-size: 11px; "
        "font-weight: bold; "
        "padding: 6px 12px; "
        "} "
        "QPushButton:hover { background-color: #E5B759; } "
        "QPushButton:pressed { background-color: #C4941F; }"
    );
    connect(downloadButton, &QPushButton::clicked, this, &DefectListWidget::onDownloadClicked);
    buttonLayout->addWidget(downloadButton);

    clearButton = new QPushButton("Clear", this);
    clearButton->setStyleSheet(
        "QPushButton { "
        "background-color: #E74C3C; "
        "color: white; "
        "border: 2px solid #E74C3C; "
        "border-radius: 6px; "
        "font-size: 11px; "
        "font-weight: bold; "
        "padding: 6px 12px; "
        "} "
        "QPushButton:hover { background-color: #EC7063; } "
        "QPushButton:pressed { background-color: #C0392B; }"
    );
    connect(clearButton, &QPushButton::clicked, this, &DefectListWidget::onClearClicked);
    buttonLayout->addWidget(clearButton);

    mainLayout->addLayout(buttonLayout);
}

void DefectListWidget::addDefect(const QString &type, const QDateTime &timestamp, const QString &severity)
{
    defectCount++;

    QString timeStr = timestamp.toString("HH:mm:ss");
    QString dateStr = timestamp.toString("yyyy-MM-dd");
    QString displayText = QString("[%1] %2 - %3 (Severity: %4)\n%5 %6")
                              .arg(defectCount)
                              .arg(type)
                              .arg(severity)
                              .arg(severity)
                              .arg(dateStr)
                              .arg(timeStr);

    QListWidgetItem *item = new QListWidgetItem(displayText);
    item->setData(Qt::UserRole, type);
    item->setData(Qt::UserRole + 1, timestamp.toString(Qt::ISODate));
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

void DefectListWidget::onUploadClicked()
{
    if (defectCount == 0) {
        QMessageBox::information(this, "Upload", "No defects to upload.");
        return;
    }
    QMessageBox::information(this, "Upload", QString("Uploading %1 defect(s)...\nData will be synchronized with the cloud server.").arg(defectCount));
    emit uploadRequested();
}

void DefectListWidget::onDownloadClicked()
{
    QMessageBox::information(this, "Download", "Downloading defect records from server...\nFetching latest data.");
    emit downloadRequested();
}

void DefectListWidget::onClearClicked()
{
    if (defectCount == 0) {
        QMessageBox::information(this, "Clear", "No defects to clear.");
        return;
    }

    int ret = QMessageBox::question(this, "Clear Defects",
                                     QString("Are you sure you want to clear all %1 defects?").arg(defectCount),
                                     QMessageBox::Yes | QMessageBox::No);
    if (ret == QMessageBox::Yes) {
        clearDefects();
        QMessageBox::information(this, "Clear", "All defects cleared.");
        emit clearRequested();
    }
}

void DefectListWidget::onDefectSelected(QListWidgetItem *item)
{
    QString type = item->data(Qt::UserRole).toString();
    QString timestamp = item->data(Qt::UserRole + 1).toString();
    QMessageBox::information(this, "Defect Details", QString("Type: %1\nTimestamp: %2").arg(type, timestamp));
}

void DefectListWidget::loadDefectsFromStorage()
{
    // Placeholder for loading defects from local storage or database
    // This would be connected to the backend
}
