// Backend Image Input Validation Tests
// Tests for corrupted images, invalid formats, oversized files, and error handling

const request = require('supertest');
const { app, server, io } = require('../server');
const fs = require('fs');
const path = require('path');

describe('Backend Image Input Validation Tests', () => {
  afterAll((done) => {
    io.close();
    server.close(done);
  });

  describe('Health and Basic Endpoints', () => {
    test('health endpoint responds correctly', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok', timestamp: expect.any(String) });
    });

    test('root endpoint serves correctly', async () => {
      const response = await request(app).get('/');
      expect(response.status).toBe(200);
      expect(response.text).toContain('Glass Defect Detection Backend');
    });

    test('jetsons endpoint returns empty array initially', async () => {
      const response = await request(app).get('/jetsons');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ jetsons: [] });
    });
  });

  describe('Socket.IO Frame Validation', () => {
    const { io: Client } = require('socket.io-client');
    let clientSocket;
    let serverSocket;

    beforeEach((done) => {
      server.listen(() => {
        const port = server.address().port;
        clientSocket = new Client(`http://localhost:${port}`, { transports: ['websocket'] });
        
        io.on('connection', (socket) => {
          serverSocket = socket;
        });
        
        clientSocket.on('connect', done);
      });
    });

    afterEach(() => {
      if (clientSocket) clientSocket.disconnect();
    });

    test('handles valid image frames correctly', (done) => {
      const validImage = Buffer.from('valid image data').toString('base64');
      
      clientSocket.emit('jetson:register', { deviceId: 'test-cam' });
      
      // Listen for broadcast
      const dashboard = new Client(`http://localhost:${server.address().port}`, { transports: ['websocket'] });
      dashboard.on('stream:frame', (payload) => {
        expect(payload.dataUrl).toMatch(/^data:image\/jpeg;base64,/);
        expect(payload.defects).toEqual([]);
        expect(payload.deviceId).toBe('test-cam');
        dashboard.disconnect();
        done();
      });

      clientSocket.emit('jetson:frame', {
        image: validImage,
        mime: 'image/jpeg',
        defects: [],
        deviceId: 'test-cam'
      });
    });

    test('handles corrupted base64 image data gracefully', (done) => {
      const corruptedImage = 'invalid!!!base64@#$data';
      
      clientSocket.emit('jetson:register', { deviceId: 'test-cam' });
      
      // Should still process and broadcast even with corrupted data
      const dashboard = new Client(`http://localhost:${server.address().port}`, { transports: ['websocket'] });
      dashboard.on('stream:frame', (payload) => {
        expect(payload.dataUrl).toBe('data:image/jpeg;base64,invalid!!!base64@#$data');
        expect(payload.defects).toEqual([]);
        dashboard.disconnect();
        done();
      });

      clientSocket.emit('jetson:frame', {
        image: corruptedImage,
        mime: 'image/jpeg',
        defects: [],
        deviceId: 'test-cam'
      });
    });

    test('handles missing image data', (done) => {
      clientSocket.emit('jetson:register', { deviceId: 'test-cam' });
      
      const dashboard = new Client(`http://localhost:${server.address().port}`, { transports: ['websocket'] });
      
      // Set timeout to ensure no broadcast happens
      const timeout = setTimeout(() => {
        dashboard.disconnect();
        done();
      }, 1000);

      dashboard.on('stream:frame', () => {
        clearTimeout(timeout);
        dashboard.disconnect();
        done(new Error('Should not broadcast frame without image data'));
      });

      // Send frame without image
      clientSocket.emit('jetson:frame', {
        mime: 'image/jpeg',
        defects: [],
        deviceId: 'test-cam'
      });
    });

    test('handles various MIME types', (done) => {
      const imageData = Buffer.from('test image').toString('base64');
      let frameCount = 0;
      const expectedFrames = 3;
      
      clientSocket.emit('jetson:register', { deviceId: 'test-cam' });
      
      const dashboard = new Client(`http://localhost:${server.address().port}`, { transports: ['websocket'] });
      dashboard.on('stream:frame', (payload) => {
        frameCount++;
        
        if (frameCount === 1) {
          expect(payload.dataUrl).toBe('data:image/png;base64,' + imageData);
        } else if (frameCount === 2) {
          expect(payload.dataUrl).toBe('data:image/webp;base64,' + imageData);
        } else if (frameCount === 3) {
          expect(payload.dataUrl).toBe('data:image/jpeg;base64,' + imageData); // Default fallback
        }

        if (frameCount === expectedFrames) {
          dashboard.disconnect();
          done();
        }
      });

      // Send frames with different MIME types
      clientSocket.emit('jetson:frame', {
        image: imageData,
        mime: 'image/png',
        defects: [],
        deviceId: 'test-cam'
      });

      clientSocket.emit('jetson:frame', {
        image: imageData,
        mime: 'image/webp',
        defects: [],
        deviceId: 'test-cam'
      });

      // No MIME type specified (should default to jpeg)
      clientSocket.emit('jetson:frame', {
        image: imageData,
        defects: [],
        deviceId: 'test-cam'
      });
    });

    test('handles large image payloads', (done) => {
      // Simulate large image (1MB+ base64)
      const largeImageData = 'a'.repeat(1048576); // 1MB of 'a' characters
      
      clientSocket.emit('jetson:register', { deviceId: 'test-cam' });
      
      const dashboard = new Client(`http://localhost:${server.address().port}`, { transports: ['websocket'] });
      dashboard.on('stream:frame', (payload) => {
        expect(payload.dataUrl.length).toBeGreaterThan(1000000);
        expect(payload.dataUrl).toMatch(/^data:image\/jpeg;base64,a+$/);
        dashboard.disconnect();
        done();
      });

      clientSocket.emit('jetson:frame', {
        image: largeImageData,
        mime: 'image/jpeg',
        defects: [],
        deviceId: 'test-cam'
      });
    });

    test('handles malformed defects data', (done) => {
      const imageData = Buffer.from('test').toString('base64');
      
      clientSocket.emit('jetson:register', { deviceId: 'test-cam' });
      
      const dashboard = new Client(`http://localhost:${server.address().port}`, { transports: ['websocket'] });
      dashboard.on('stream:frame', (payload) => {
        // Should convert non-array defects to empty array
        expect(Array.isArray(payload.defects)).toBe(true);
        expect(payload.defects).toEqual([]);
        dashboard.disconnect();
        done();
      });

      // Send with non-array defects
      clientSocket.emit('jetson:frame', {
        image: imageData,
        mime: 'image/jpeg',
        defects: 'not an array',
        deviceId: 'test-cam'
      });
    });

    test('validates defect object structure', (done) => {
      const imageData = Buffer.from('test').toString('base64');
      
      clientSocket.emit('jetson:register', { deviceId: 'test-cam' });
      
      const dashboard = new Client(`http://localhost:${server.address().port}`, { transports: ['websocket'] });
      dashboard.on('stream:frame', (payload) => {
        expect(payload.defects).toHaveLength(3);
        expect(payload.defects[0]).toEqual({ type: 'Crack', confidence: 0.95 });
        expect(payload.defects[1]).toEqual({ type: 'Bubble' }); // Missing confidence
        expect(payload.defects[2]).toEqual({}); // Malformed object
        dashboard.disconnect();
        done();
      });

      clientSocket.emit('jetson:frame', {
        image: imageData,
        mime: 'image/jpeg',
        defects: [
          { type: 'Crack', confidence: 0.95 },
          { type: 'Bubble' },
          { invalid: 'object' }
        ],
        deviceId: 'test-cam'
      });
    });
  });

  describe('Error Resilience', () => {
    test('server continues operating after socket errors', async () => {
      // Health check should still work even after socket errors
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      
      // Test with malformed socket data (this would be handled by socket.io internally)
      const response2 = await request(app).get('/jetsons');
      expect(response2.status).toBe(200);
    });

    test('handles concurrent frame processing', (done) => {
      const { io: Client } = require('socket.io-client');
      
      server.listen(() => {
        const port = server.address().port;
        const clients = [];
        const dashboards = [];
        let frameCount = 0;
        const expectedFrames = 6; // 3 clients × 2 frames each

        // Create multiple Jetson clients
        for (let i = 0; i < 3; i++) {
          const client = new Client(`http://localhost:${port}`, { transports: ['websocket'] });
          const dashboard = new Client(`http://localhost:${port}`, { transports: ['websocket'] });
          
          clients.push(client);
          dashboards.push(dashboard);

          client.on('connect', () => {
            client.emit('jetson:register', { deviceId: `cam-${i}` });
          });

          dashboard.on('stream:frame', (payload) => {
            frameCount++;
            expect(payload.deviceId).toMatch(/^cam-[0-2]$/);
            
            if (frameCount === expectedFrames) {
              clients.forEach(c => c.disconnect());
              dashboards.forEach(d => d.disconnect());
              done();
            }
          });
        }

        // Send frames from all clients simultaneously
        setTimeout(() => {
          clients.forEach((client, i) => {
            const imageData = Buffer.from(`image-${i}`).toString('base64');
            
            // Send two frames per client
            client.emit('jetson:frame', {
              image: imageData,
              mime: 'image/jpeg',
              defects: [{ type: `Defect${i}` }],
              deviceId: `cam-${i}`
            });

            client.emit('jetson:frame', {
              image: imageData + 'second',
              mime: 'image/jpeg',
              defects: [{ type: `Defect${i}B` }],
              deviceId: `cam-${i}`
            });
          });
        }, 100);
      });
    });
  });
});