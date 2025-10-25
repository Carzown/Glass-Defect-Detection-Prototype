const request = require('supertest');
const { io: Client } = require('socket.io-client');

// Import server elements and control the listener in tests
const { app, server, io } = require('../server');

function getAddressPort(srv) {
  const addr = srv.address();
  if (!addr) return null;
  return typeof addr === 'string' ? addr : addr.port;
}

describe('Backend extra suite (HTTP + Socket.IO)', () => {
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

  test('GET / returns expected welcome text', async () => {
    const res = await request(app).get('/').expect(200);
    expect(res.text).toBe('Backend connected successfully!');
  });

  test('CORS header is present on /health', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  test('jetson:frame with image/png produces dataUrl png prefix', (done) => {
    const jetson = new Client(baseURL, { transports: ['websocket'] });
    const dashboard = new Client(baseURL, { transports: ['websocket'] });

    const timer = setTimeout(() => done(new Error('No stream:frame received')), 3000);

    dashboard.on('stream:frame', (payload) => {
      try {
        expect(payload.dataUrl).toMatch(/^data:image\/png;base64,/);
        clearTimeout(timer);
        jetson.disconnect();
        dashboard.disconnect();
        done();
      } catch (e) { done(e); }
    });

    jetson.on('connect', () => {
      const image = Buffer.from('png').toString('base64');
      jetson.emit('jetson:frame', { image, mime: 'image/png' });
    });
  });

  test('jetson:frame without time includes ISO timestamp string', (done) => {
    const jetson = new Client(baseURL, { transports: ['websocket'] });
    const dashboard = new Client(baseURL, { transports: ['websocket'] });

    const timer = setTimeout(() => done(new Error('No stream:frame received')), 3000);

    dashboard.on('stream:frame', (payload) => {
      try {
        expect(typeof payload.time).toBe('string');
        expect(() => Date.parse(payload.time)).not.toThrow();
        expect(isNaN(Date.parse(payload.time))).toBe(false);
        clearTimeout(timer);
        jetson.disconnect();
        dashboard.disconnect();
        done();
      } catch (e) { done(e); }
    });

    jetson.on('connect', () => {
      const image = Buffer.from('ts').toString('base64');
      jetson.emit('jetson:frame', { image }); // no time set
    });
  });

  test('jetson:status without deviceId uses registered deviceId', (done) => {
    const jetson = new Client(baseURL, { transports: ['websocket'] });
    const dashboard = new Client(baseURL, { transports: ['websocket'] });

    let gotOnline = false;
    const timer = setTimeout(() => done(new Error('No status received')), 3000);

    dashboard.on('jetson:status', (payload) => {
      if (!gotOnline) {
        // initial register
        expect(payload).toMatchObject({ online: true, deviceId: 'cam-X' });
        gotOnline = true;
        // now emit status without deviceId
        jetson.emit('jetson:status', { online: true });
      } else {
        try {
          expect(payload).toMatchObject({ online: true, deviceId: 'cam-X' });
          clearTimeout(timer);
          jetson.disconnect();
          dashboard.disconnect();
          done();
        } catch (e) { done(e); }
      }
    });

    jetson.on('connect', () => {
      jetson.emit('jetson:register', { deviceId: 'cam-X' });
    });
  });

  test('jetson:register with no deviceId defaults to "jetson-1"', (done) => {
    const jetson = new Client(baseURL, { transports: ['websocket'] });
    const dashboard = new Client(baseURL, { transports: ['websocket'] });

    const timer = setTimeout(() => done(new Error('No status received')), 3000);

    dashboard.on('jetson:status', (payload) => {
      try {
        expect(payload).toMatchObject({ online: true, deviceId: 'jetson-1' });
        clearTimeout(timer);
        jetson.disconnect();
        dashboard.disconnect();
        done();
      } catch (e) { done(e); }
    });

    jetson.on('connect', () => {
      jetson.emit('jetson:register', {});
    });
  });

  test('re-registering with a new deviceId updates subsequent status', (done) => {
    const jetson = new Client(baseURL, { transports: ['websocket'] });
    const dashboard = new Client(baseURL, { transports: ['websocket'] });

    let seen = [];
    const timer = setTimeout(() => done(new Error('No subsequent status received')), 3000);

    dashboard.on('jetson:status', (payload) => {
      seen.push(payload.deviceId);
      if (seen.length === 1) {
        expect(seen[0]).toBe('cam-A');
        // re-register as cam-B
        jetson.emit('jetson:register', { deviceId: 'cam-B' });
      } else if (seen.length === 2) {
        try {
          expect(seen[1]).toBe('cam-B');
          clearTimeout(timer);
          jetson.disconnect();
          dashboard.disconnect();
          done();
        } catch (e) { done(e); }
      }
    });

    jetson.on('connect', () => {
      jetson.emit('jetson:register', { deviceId: 'cam-A' });
    });
  });

  test('disconnecting a non-jetson client does not broadcast offline status', (done) => {
    const dashboardListener = new Client(baseURL, { transports: ['websocket'] });
    const plainClient = new Client(baseURL, { transports: ['websocket'] });

    let gotStatus = false;
    const timer = setTimeout(() => {
      try {
        expect(gotStatus).toBe(false);
        dashboardListener.disconnect();
        done();
      } catch (e) { done(e); }
    }, 800);

    dashboardListener.on('jetson:status', () => { gotStatus = true; });

    plainClient.on('connect', () => {
      // no register => role is not jetson
      plainClient.disconnect();
    });
  });

  test('jetson:frame with empty image string is ignored', (done) => {
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

    dashboard.on('stream:frame', () => { gotFrame = true; });

    jetson.on('connect', () => {
      jetson.emit('jetson:frame', { image: '' }); // empty string => ignore
    });
  });
});
