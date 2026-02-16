#ifndef DEFECTLISTWIDGET_H
#define DEFECTLISTWIDGET_H

#include <QWidget>
#include <QListWidget>
#include <QDateTime>

class DefectListWidget : public QWidget
{
    Q_OBJECT

public:
    explicit DefectListWidget(QWidget *parent = nullptr);
    ~DefectListWidget();

    void addDefect(const QString &type, const QDateTime &timestamp, const QString &severity, double confidence, const QString &imagePath = "");
    void clearDefects();
    int getDefectCount() const;

signals:

private slots:
    void onDefectSelected(QListWidgetItem *item);

private:
    void setupUI();
    void loadDefectsFromStorage();

    QListWidget *defectList;
    int defectCount;
};

#endif // DEFECTLISTWIDGET_H
