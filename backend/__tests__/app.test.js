const { io: Client } = require('socket.io-client');
const { app, server, io } = require('../server');

function getAddressPort(srv) {
  const addr = srv.address();
  if (!addr) return null;
  return typeof addr === 'string' ? addr : addr.port;
}

/**
 * app.test.js
 * Focused Socket.IO integration test for presentation:
 * - Jetson frame -> dashboard receives stream:frame with imageUrl + defects
 */
describe('Jetson -> Relay imageUrl and defects', () => {
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

  test('Jetson relays ImageUrl and defects', (done) => {
    const jetson = new Client(baseURL, { transports: ['websocket'] });
    const dashboard = new Client(baseURL, { transports: ['websocket'] });

    const img = Buffer.from('frame').toString('base64');
    const timer = setTimeout(() => done(new Error('No stream:frame received')), 2500);

    dashboard.on('stream:frame', (payload) => {
      try {
        expect(payload.dataUrl).toMatch(/^data:image\/jpeg;base64,/);
        expect(Array.isArray(payload.defects)).toBe(true);
        expect(payload.defects[0]).toEqual({ type: 'Crack' });
        clearTimeout(timer);
        jetson.disconnect();
        dashboard.disconnect();
        done();
      } catch (e) { done(e); }
    });

    jetson.on('connect', () => {
      // Optional: register to set deviceId on the socket context
      jetson.emit('jetson:register', { deviceId: 'present-cam' });
      jetson.emit('jetson:frame', {
        image: img,
        mime: 'image/jpeg',
        defects: [{ type: 'Crack' }],
        time: new Date().toISOString(),
        deviceId: 'present-cam'
      });
    });
  });
});
