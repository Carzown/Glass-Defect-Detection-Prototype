import time
import socketio
import pytest

# Notes:
# - These are simple, happy-path integration checks using python-socketio.
# - The Node backend identifies dashboards when they emit 'client:hello' with role 'dashboard'.
# - Jetson sends 'jetson:register' and 'jetson:frame' which should be relayed to dashboards.


def test_jetson_register_broadcasts_status(backend_url, backend_ready):
    sio_dash = socketio.Client()
    received = {}

    @sio_dash.on('jetson:status')
    def on_status(payload):
        received['status'] = payload

    sio_dash.connect(backend_url, transports=['websocket'])
    sio_dash.emit('client:hello', { 'role': 'dashboard' })

    sio_jetson = socketio.Client()
    sio_jetson.connect(backend_url, transports=['websocket'])
    sio_jetson.emit('jetson:register', { 'deviceId': 'PYTEST_CAM' })

    # small wait
    timeout = time.time() + 2
    while 'status' not in received and time.time() < timeout:
        time.sleep(0.05)

    try:
        assert 'status' in received
        assert received['status'].get('deviceId') == 'PYTEST_CAM'
        assert received['status'].get('online') is True
    finally:
        sio_jetson.disconnect()
        sio_dash.disconnect()


def test_jetson_frame_relay_to_dashboard(backend_url, backend_ready):
    sio_dash = socketio.Client()
    got_frame = {}

    @sio_dash.on('stream:frame')
    def on_frame(payload):
        got_frame['frame'] = payload

    sio_dash.connect(backend_url, transports=['websocket'])
    sio_dash.emit('client:hello', { 'role': 'dashboard' })

    sio_jetson = socketio.Client()
    sio_jetson.connect(backend_url, transports=['websocket'])
    sio_jetson.emit('jetson:register', { 'deviceId': 'PYTEST_CAM' })

    sio_jetson.emit('jetson:frame', {
        'mime': 'image/jpeg',
        'image': 'AAA',  # minimal base64 string
        'time': int(time.time() * 1000),
        'defects': [{ 'type': 'Crack' }]
    })

    timeout = time.time() + 2
    while 'frame' not in got_frame and time.time() < timeout:
        time.sleep(0.05)

    try:
        assert 'frame' in got_frame
        frame = got_frame['frame']
        assert frame.get('dataUrl', '').startswith('data:image/jpeg;base64,')
        assert frame.get('deviceId') == 'PYTEST_CAM'
        assert isinstance(frame.get('defects'), list)
        assert frame['defects'][0]['type'] == 'Crack'
    finally:
        sio_jetson.disconnect()
        sio_dash.disconnect()


def test_jetson_disconnect_broadcasts_offline(backend_url, backend_ready):
    sio_dash = socketio.Client()
    statuses = []

    @sio_dash.on('jetson:status')
    def on_status(payload):
        statuses.append(payload)

    sio_dash.connect(backend_url, transports=['websocket'])
    sio_dash.emit('client:hello', { 'role': 'dashboard' })

    sio_jetson = socketio.Client()
    sio_jetson.connect(backend_url, transports=['websocket'])
    sio_jetson.emit('jetson:register', { 'deviceId': 'PYTEST_CAM' })

    # Wait for online
    t = time.time() + 2
    while (not statuses) and time.time() < t:
        time.sleep(0.05)

    # Disconnect jetson, expect offline broadcast
    sio_jetson.disconnect()

    t = time.time() + 2
    while (len(statuses) < 2) and time.time() < t:
        time.sleep(0.05)

    try:
        assert len(statuses) >= 2
        assert statuses[-1].get('deviceId') == 'PYTEST_CAM'
        assert statuses[-1].get('online') is False
    finally:
        sio_dash.disconnect()
