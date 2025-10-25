const request = require('supertest');
const { io: Client } = require('socket.io-client');

// We'll import the server elements and control the listener in tests
const { app, server, io } = require('../server');

function getAddressPort(srv) {
  const addr = srv.address();
  if (!addr) return null;
  return typeof addr === 'string' ? addr : addr.port;
}

describe('Backend HTTP and Socket.IO', () => {
  let baseURL;

  beforeAll((done) => {
    server.listen(0, () => {
      const port = getAddressPort(server);
      baseURL = `http://localhost:${port}`;
      done();
    });
  });

  afterAll((done) => {
    io.close();
    server.close(done);
  });

  test('GET /health returns ok:true', async () => {
    // server.js defines /health route
    const res = await request(app).get('/health').expect(200);
    expect(res.body).toEqual({ ok: true });
  });

  test('jetson:register broadcasts jetson:status to other clients', (done) => {
    const jetson = new Client(baseURL, { transports: ['websocket'] });
    const dashboard = new Client(baseURL, { transports: ['websocket'] });

    let received = false;
    const timer = setTimeout(() => {
      if (!received) done(new Error('No jetson:status received'));
    }, 3000);

    dashboard.on('jetson:status', (payload) => {
      try {
        expect(payload).toMatchObject({ online: true, deviceId: 'cam-1' });
        received = true;
        clearTimeout(timer);
        jetson.disconnect();
        dashboard.disconnect();
        done();
      } catch (e) {
        done(e);
      }
    });

    jetson.on('connect', () => {
      jetson.emit('jetson:register', { deviceId: 'cam-1' });
    });
  });

  test('jetson:frame relays stream:frame with dataUrl and defects', (done) => {
    const jetson = new Client(baseURL, { transports: ['websocket'] });
    const dashboard = new Client(baseURL, { transports: ['websocket'] });

    const fakeImageBase64 = Buffer.from('hello').toString('base64');
    const timer = setTimeout(() => done(new Error('No stream:frame received')), 3000);

    dashboard.on('stream:frame', (payload) => {
      try {
        expect(payload.dataUrl).toMatch(/^data:image\/jpeg;base64,/);
        expect(payload.defects).toEqual([{ type: 'Crack' }]);
        expect(typeof payload.time).toBe('string');
        clearTimeout(timer);
        jetson.disconnect();
        dashboard.disconnect();
        done();
      } catch (e) {
        done(e);
      }
    });

    jetson.on('connect', () => {
      jetson.emit('jetson:frame', {
        image: fakeImageBase64,
        mime: 'image/jpeg',
        time: new Date().toISOString(),
        defects: [{ type: 'Crack' }],
        deviceId: 'cam-1'
      });
    });
  });

  test('jetson disconnect broadcasts offline status', (done) => {
    const jetson = new Client(baseURL, { transports: ['websocket'] });
    const dashboard = new Client(baseURL, { transports: ['websocket'] });

    let statusCount = 0;
    const timer = setTimeout(() => done(new Error('No offline status received')), 3000);

    dashboard.on('jetson:status', (payload) => {
      statusCount++;
      if (statusCount === 1) {
        // first should be online after register
        expect(payload).toMatchObject({ online: true, deviceId: 'cam-2' });
        // then disconnect jetson
        jetson.disconnect();
      } else if (statusCount === 2) {
        try {
          expect(payload).toMatchObject({ online: false, deviceId: 'cam-2' });
          clearTimeout(timer);
          dashboard.disconnect();
          done();
        } catch (e) { done(e); }
      }
    });

    jetson.on('connect', () => {
      jetson.emit('jetson:register', { deviceId: 'cam-2' });
    });
  });

  test('malformed jetson:frame (no image) is ignored (no stream:frame)', (done) => {
    const jetson = new Client(baseURL, { transports: ['websocket'] });
    const dashboard = new Client(baseURL, { transports: ['websocket'] });

    let gotFrame = false;
    const timer = setTimeout(() => {
      try {
        expect(gotFrame).toBe(false);
        jetson.disconnect();
        dashboard.disconnect();
        done();
      } catch (e) { done(e); }
    }, 1000);

    dashboard.on('stream:frame', () => {
      gotFrame = true;
    });

    jetson.on('connect', () => {
      jetson.emit('jetson:frame', { defects: [{ type: 'X' }] }); // no image field
    });
  });

  test('stream:frame is not echoed back to the sending Jetson (broadcast only)', (done) => {
    const jetson = new Client(baseURL, { transports: ['websocket'] });

    let gotEcho = false;
    const timer = setTimeout(() => {
      try {
        expect(gotEcho).toBe(false);
        jetson.disconnect();
        done();
      } catch (e) { done(e); }
    }, 800);

    jetson.on('stream:frame', () => { gotEcho = true; });

    jetson.on('connect', () => {
      const image = Buffer.from('x').toString('base64');
      jetson.emit('jetson:frame', { image });
    });
  });

  test('default mime is image/jpeg when omitted', (done) => {
    const jetson = new Client(baseURL, { transports: ['websocket'] });
    const dashboard = new Client(baseURL, { transports: ['websocket'] });

    const timer = setTimeout(() => done(new Error('No stream:frame received')), 3000);

    dashboard.on('stream:frame', (payload) => {
      try {
        expect(payload.dataUrl).toMatch(/^data:image\/jpeg;base64,/);
        clearTimeout(timer);
        jetson.disconnect();
        dashboard.disconnect();
        done();
      } catch (e) { done(e); }
    });

    jetson.on('connect', () => {
      const image = Buffer.from('y').toString('base64');
      jetson.emit('jetson:frame', { image }); // no mime provided
    });
  });

  test('multiple dashboards receive the same stream:frame', (done) => {
    const jetson = new Client(baseURL, { transports: ['websocket'] });
    const d1 = new Client(baseURL, { transports: ['websocket'] });
    const d2 = new Client(baseURL, { transports: ['websocket'] });

    let count = 0;
    const finish = () => {
      if (++count === 2) {
        try {
          jetson.disconnect(); d1.disconnect(); d2.disconnect();
          done();
        } catch (e) { done(e); }
      }
    };

    d1.on('stream:frame', () => finish());
    d2.on('stream:frame', () => finish());

    const timer = setTimeout(() => done(new Error('Dashboards did not both receive frame')), 3000);
    const clearAll = () => { clearTimeout(timer); };
    d1.on('stream:frame', clearAll);
    d2.on('stream:frame', clearAll);

    jetson.on('connect', () => {
      const image = Buffer.from('z').toString('base64');
      jetson.emit('jetson:frame', { image, mime: 'image/png' });
    });
  });

  test('jetson:status relays deviceId even without prior register', (done) => {
    const jetson = new Client(baseURL, { transports: ['websocket'] });
    const dashboard = new Client(baseURL, { transports: ['websocket'] });

    const timer = setTimeout(() => done(new Error('No jetson:status received')), 3000);

    dashboard.on('jetson:status', (payload) => {
      try {
        expect(payload).toMatchObject({ online: true, deviceId: 'cam-Z' });
        clearTimeout(timer);
        jetson.disconnect();
        dashboard.disconnect();
        done();
      } catch (e) { done(e); }
    });

    jetson.on('connect', () => {
      jetson.emit('jetson:status', { online: true, deviceId: 'cam-Z' });
    });
  });

  test('stream:frame includes deviceId from register', (done) => {
    const jetson = new Client(baseURL, { transports: ['websocket'] });
    const dashboard = new Client(baseURL, { transports: ['websocket'] });

    const image = Buffer.from('ok').toString('base64');
    const timer = setTimeout(() => done(new Error('No stream:frame received')), 3000);

    dashboard.on('stream:frame', (payload) => {
      try {
        expect(payload.deviceId).toBe('cam-9');
        clearTimeout(timer);
        jetson.disconnect();
        dashboard.disconnect();
        done();
      } catch (e) { done(e); }
    });

    jetson.on('connect', () => {
      jetson.emit('jetson:register', { deviceId: 'cam-9' });
      jetson.emit('jetson:frame', { image });
    });
  });
});
