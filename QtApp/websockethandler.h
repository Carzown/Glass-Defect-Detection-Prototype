#ifndef WEBSOCKETHANDLER_H
#define WEBSOCKETHANDLER_H

#include <QObject>
#include <QWebSocket>
#include <QUrl>
#include <QJsonObject>
#include <QString>

class WebSocketHandler : public QObject
{
    Q_OBJECT

public:
    explicit WebSocketHandler(const QString &serverUrl = "wss://glass-defect-detection-prototype-production.up.railway.app:8080", QObject *parent = nullptr);
    ~WebSocketHandler();

    void connectToServer();
    void disconnectFromServer();
    void sendMessage(const QJsonObject &data);
    void sendDefect(const QString &type, const QString &timestamp, const QString &severity, const QString &imagePath = "");
    void sendStatus(const QString &status);
    bool isConnected() const { return m_connected; }

signals:
    void connected();
    void disconnected();
    void errorOccurred(const QString &error);
    void messageReceived(const QJsonObject &data);

private slots:
    void onConnected();
    void onDisconnected();
    void onTextMessageReceived(const QString &message);
    void onError(QAbstractSocket::SocketError error);

private:
    QWebSocket *socket;
    QUrl serverUrl;
    bool m_connected;
};

#endif // WEBSOCKETHANDLER_H
