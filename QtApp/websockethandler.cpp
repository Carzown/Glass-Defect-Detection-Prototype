#include "websockethandler.h"
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QDebug>
#include <QDateTime>

WebSocketHandler::WebSocketHandler(const QString &serverUrl, QObject *parent)
    : QObject(parent), socket(nullptr), serverUrl(serverUrl), m_connected(false)
{
    socket = new QWebSocket(QString(), QWebSocketProtocol::VersionLatest, this);
    
    connect(socket, &QWebSocket::connected, this, &WebSocketHandler::onConnected);
    connect(socket, &QWebSocket::disconnected, this, &WebSocketHandler::onDisconnected);
    connect(socket, QOverload<const QString &>::of(&QWebSocket::textMessageReceived),
            this, &WebSocketHandler::onTextMessageReceived);
    connect(socket, &QWebSocket::errorOccurred,
            this, &WebSocketHandler::onError);
}

WebSocketHandler::~WebSocketHandler()
{
    if (socket) {
        socket->close();
    }
}

void WebSocketHandler::connectToServer()
{
    qDebug() << "[WebSocket] Connecting to" << serverUrl.toString();
    socket->open(serverUrl);
}

void WebSocketHandler::disconnectFromServer()
{
    if (socket) {
        socket->close();
    }
}

void WebSocketHandler::sendMessage(const QJsonObject &data)
{
    if (socket && socket->isValid()) {
        QJsonDocument doc(data);
        socket->sendTextMessage(QString::fromUtf8(doc.toJson(QJsonDocument::Compact)));
        qDebug() << "[WebSocket] Sent message:" << doc.toJson(QJsonDocument::Compact);
    }
}

void WebSocketHandler::sendDefect(const QString &type, const QString &timestamp, const QString &severity, const QString &imagePath)
{
    QJsonObject obj;
    obj["type"] = "defect";
    obj["defect_type"] = type;
    obj["timestamp"] = timestamp;
    obj["severity"] = severity;
    obj["device_id"] = "raspberry-pi-1";
    if (!imagePath.isEmpty()) {
        obj["image_path"] = imagePath;
    }
    
    sendMessage(obj);
}

void WebSocketHandler::sendStatus(const QString &status)
{
    QJsonObject obj;
    obj["type"] = "status";
    obj["status"] = status;
    obj["device_id"] = "raspberry-pi-1";
    obj["timestamp"] = QDateTime::currentDateTime().toString(Qt::ISODate);
    
    sendMessage(obj);
}

void WebSocketHandler::onConnected()
{
    m_connected = true;
    qDebug() << "[WebSocket] Connected";
    emit connected();
    
    // Register as device with server
    QJsonObject registrationMsg;
    registrationMsg["type"] = "device_register";
    registrationMsg["device_id"] = "raspberry-pi-1";
    
    sendMessage(registrationMsg);
}

void WebSocketHandler::onDisconnected()
{
    m_connected = false;
    qDebug() << "[WebSocket] Disconnected";
    emit disconnected();
}

void WebSocketHandler::onTextMessageReceived(const QString &message)
{
    qDebug() << "[WebSocket] Received:" << message;
    
    QJsonDocument doc = QJsonDocument::fromJson(message.toUtf8());
    if (doc.isObject()) {
        emit messageReceived(doc.object());
    }
}

void WebSocketHandler::onError(QAbstractSocket::SocketError error)
{
    QString errorStr;
    switch (error) {
        case QAbstractSocket::ConnectionRefusedError:
            errorStr = "Connection refused";
            break;
        case QAbstractSocket::RemoteHostClosedError:
            errorStr = "Remote host closed";
            break;
        case QAbstractSocket::HostNotFoundError:
            errorStr = "Host not found";
            break;
        default:
            errorStr = socket->errorString();
    }
    
    qWarning() << "[WebSocket] Error:" << errorStr;
    emit errorOccurred(errorStr);
}
