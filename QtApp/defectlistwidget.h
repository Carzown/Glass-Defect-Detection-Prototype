#ifndef DEFECTLISTWIDGET_H
#define DEFECTLISTWIDGET_H

#include <QWidget>
#include <QListWidget>
#include <QDateTime>
#include <QPushButton>

class DefectListWidget : public QWidget
{
    Q_OBJECT

public:
    explicit DefectListWidget(QWidget *parent = nullptr);
    ~DefectListWidget();

    void addDefect(const QString &type, const QDateTime &timestamp, const QString &severity);
    void clearDefects();
    int getDefectCount() const;

signals:
    void uploadRequested();
    void downloadRequested();
    void clearRequested();

private slots:
    void onUploadClicked();
    void onDownloadClicked();
    void onClearClicked();
    void onDefectSelected(QListWidgetItem *item);

private:
    void setupUI();
    void loadDefectsFromStorage();

    QListWidget *defectList;
    QPushButton *uploadButton;
    QPushButton *downloadButton;
    QPushButton *clearButton;
    int defectCount;
};

#endif // DEFECTLISTWIDGET_H
