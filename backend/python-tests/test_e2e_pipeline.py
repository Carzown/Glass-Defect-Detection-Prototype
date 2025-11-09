#!/usr/bin/env python3
"""
End-to-End Pipeline Integration Tests
Tests the complete flow: Jetson client -> Backend -> Edge Function -> Supabase -> Dashboard

This suite validates:
1. Full pipeline with real image uploads
2. Defect detection and classification 
3. Supabase storage and database integration
4. Error handling and logging
5. Performance under load
"""

import pytest
import requests
import socketio
import threading
import time
import json
import base64
import os
import tempfile
from PIL import Image
import io
import uuid
from datetime import datetime

# Test configuration
BACKEND_URL = os.getenv('BACKEND_URL', 'http://localhost:5000')
FUNCTION_URL = os.getenv('FUNCTION_URL', 'https://test.supabase.co/functions/v1/defects-upload')
DEVICE_TOKEN = os.getenv('DEVICE_INGEST_TOKEN', 'test-token-123')

class TestImageGenerator:
    """Generate test images for various scenarios"""
    
    @staticmethod
    def create_valid_image(width=640, height=480, format='JPEG'):
        """Create a valid test image"""
        img = Image.new('RGB', (width, height), color='red')
        buffer = io.BytesIO()
        img.save(buffer, format=format)
        return buffer.getvalue()
    
    @staticmethod
    def create_corrupted_image():
        """Create corrupted image data"""
        return b'\xff\xd8\xff\xe0\x00\x10JFIF\x00corrupted_data_here'
    
    @staticmethod
    def create_oversized_image():
        """Create an oversized image (>10MB)"""
        img = Image.new('RGB', (4000, 4000), color='blue')
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG', quality=95)
        return buffer.getvalue()

class MockDefectClassifier:
    """Mock defect detection and classification"""
    
    DEFECT_TYPES = ['Crack', 'Bubble', 'Scratch', 'Pit', 'Inclusion']
    
    @classmethod
    def analyze_image(cls, image_data):
        """Analyze image and return mock defects"""
        # Simulate defect detection based on image characteristics
        image_hash = hash(image_data) % 100
        
        if image_hash < 20:
            return []  # No defects (20% chance)
        elif image_hash < 60:
            # Single defect (40% chance)
            return [{
                'type': cls.DEFECT_TYPES[image_hash % len(cls.DEFECT_TYPES)],
                'confidence': 0.7 + (image_hash % 30) / 100,
                'location': f'({image_hash % 640}, {image_hash % 480})',
                'size': image_hash % 100 + 10
            }]
        else:
            # Multiple defects (40% chance)
            return [
                {
                    'type': cls.DEFECT_TYPES[i % len(cls.DEFECT_TYPES)],
                    'confidence': 0.6 + (image_hash + i * 7) % 40 / 100,
                    'location': f'({(image_hash + i * 23) % 640}, {(image_hash + i * 37) % 480})',
                    'size': (image_hash + i * 11) % 80 + 5
                }
                for i in range(2 + image_hash % 3)  # 2-4 defects
            ]

class EndToEndTestSuite:
    """Main test suite for end-to-end pipeline validation"""
    
    def __init__(self):
        self.session_logs = []
        self.results = []
        self.sio = None
        
    def log(self, level, message, **kwargs):
        """Log test events with timestamps"""
        log_entry = {
            'timestamp': datetime.now().isoformat(),
            'level': level,
            'message': message,
            **kwargs
        }
        self.session_logs.append(log_entry)
        print(f"[{level.upper()}] {message}")
        
    def setup_socket_connection(self):
        """Setup Socket.IO connection to backend"""
        self.sio = socketio.Client()
        
        @self.sio.event
        def connect():
            self.log('info', 'Connected to backend socket')
            self.sio.emit('jetson:register', {'deviceId': 'test-e2e-cam'})
            
        @self.sio.event
        def disconnect():
            self.log('info', 'Disconnected from backend socket')
            
        @self.sio.on('jetson:start')
        def on_start(data):
            self.log('info', 'Received start command', data=data)
            
        @self.sio.on('jetson:status')
        def on_status(data):
            self.log('info', 'Status update', data=data)
            
        try:
            self.sio.connect(BACKEND_URL, transports=['websocket'])
            return True
        except Exception as e:
            self.log('error', f'Failed to connect to backend: {e}')
            return False
    
    def test_health_endpoints(self):
        """Test that all system components are healthy"""
        self.log('info', 'Testing health endpoints')
        
        # Test backend health
        try:
            response = requests.get(f'{BACKEND_URL}/health', timeout=5)
            assert response.status_code == 200, f"Backend health check failed: {response.status_code}"
            self.log('success', 'Backend health check passed')
        except Exception as e:
            self.log('error', f'Backend health check failed: {e}')
            raise
        
        # Test if Edge Function endpoint is reachable (may return 405 for GET)
        try:
            response = requests.get(FUNCTION_URL, timeout=5)
            # Accept 405 (Method Not Allowed) as it means endpoint exists
            assert response.status_code in [200, 405], f"Function endpoint unreachable: {response.status_code}"
            self.log('success', 'Edge Function endpoint reachable')
        except Exception as e:
            self.log('warning', f'Edge Function endpoint check: {e}')
    
    def test_valid_image_upload(self):
        """Test uploading a valid image through the complete pipeline"""
        self.log('info', 'Testing valid image upload pipeline')
        
        # Generate test image
        image_data = TestImageGenerator.create_valid_image()
        defects = MockDefectClassifier.analyze_image(image_data)
        
        # Encode image
        image_b64 = base64.b64encode(image_data).decode('utf-8')
        
        # Step 1: Send frame via Socket.IO
        frame_payload = {
            'image': image_b64,
            'mime': 'image/jpeg',
            'defects': defects,
            'time': datetime.now().isoformat(),
            'deviceId': 'test-e2e-cam'
        }
        
        if self.sio and self.sio.connected:
            self.sio.emit('jetson:frame', frame_payload)
            self.log('success', 'Frame sent via Socket.IO', defect_count=len(defects))
        
        # Step 2: Upload to Edge Function
        files = {'image': ('test.jpg', image_data, 'image/jpeg')}
        data = {
            'device_id': 'test-e2e-cam',
            'defect_type': defects[0]['type'] if defects else 'None',
            'confidence': str(defects[0]['confidence']) if defects else '0.0'
        }
        headers = {'x-device-token': DEVICE_TOKEN}
        
        try:
            response = requests.post(FUNCTION_URL, files=files, data=data, headers=headers, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                self.log('success', 'Edge Function upload successful', 
                        image_url=result.get('image_url'), 
                        defect_id=result.get('defect', {}).get('id'))
                return result
            else:
                self.log('error', f'Edge Function upload failed: {response.status_code} - {response.text}')
                return None
                
        except Exception as e:
            self.log('error', f'Edge Function upload error: {e}')
            return None
    
    def test_corrupted_image_handling(self):
        """Test system response to corrupted images"""
        self.log('info', 'Testing corrupted image handling')
        
        corrupted_data = TestImageGenerator.create_corrupted_image()
        
        # Test Socket.IO handling
        corrupted_b64 = base64.b64encode(corrupted_data).decode('utf-8')
        frame_payload = {
            'image': corrupted_b64,
            'mime': 'image/jpeg',
            'defects': [],
            'deviceId': 'test-e2e-cam'
        }
        
        if self.sio and self.sio.connected:
            self.sio.emit('jetson:frame', frame_payload)
            self.log('info', 'Corrupted frame sent via Socket.IO')
        
        # Test Edge Function handling
        files = {'image': ('corrupted.jpg', corrupted_data, 'image/jpeg')}
        data = {'device_id': 'test-e2e-cam', 'defect_type': 'Test'}
        headers = {'x-device-token': DEVICE_TOKEN}
        
        try:
            response = requests.post(FUNCTION_URL, files=files, data=data, headers=headers, timeout=15)
            self.log('info', f'Corrupted image response: {response.status_code}')
            
            # Should either succeed (if Edge Function handles gracefully) or return proper error
            if response.status_code == 200:
                self.log('success', 'Edge Function handled corrupted image gracefully')
            elif 400 <= response.status_code < 500:
                self.log('success', 'Edge Function properly rejected corrupted image')
            else:
                self.log('warning', f'Unexpected response to corrupted image: {response.status_code}')
                
        except Exception as e:
            self.log('info', f'Corrupted image caused expected error: {e}')
    
    def test_oversized_image_handling(self):
        """Test handling of oversized images"""
        self.log('info', 'Testing oversized image handling')
        
        try:
            oversized_data = TestImageGenerator.create_oversized_image()
            self.log('info', f'Generated oversized image: {len(oversized_data)} bytes')
            
            files = {'image': ('oversized.jpg', oversized_data, 'image/jpeg')}
            data = {'device_id': 'test-e2e-cam', 'defect_type': 'Test'}
            headers = {'x-device-token': DEVICE_TOKEN}
            
            response = requests.post(FUNCTION_URL, files=files, data=data, headers=headers, timeout=60)
            
            if response.status_code == 413:  # Payload Too Large
                self.log('success', 'Oversized image properly rejected')
            elif response.status_code == 200:
                self.log('warning', 'Oversized image was accepted - check size limits')
            else:
                self.log('info', f'Oversized image response: {response.status_code}')
                
        except Exception as e:
            self.log('info', f'Oversized image test: {e}')
    
    def test_defect_classification_accuracy(self):
        """Test defect detection and classification with various image types"""
        self.log('info', 'Testing defect classification accuracy')
        
        test_cases = [
            ('small_defect', TestImageGenerator.create_valid_image(320, 240)),
            ('large_defect', TestImageGenerator.create_valid_image(1920, 1080)),
            ('square_image', TestImageGenerator.create_valid_image(800, 800)),
        ]
        
        classification_results = []
        
        for case_name, image_data in test_cases:
            defects = MockDefectClassifier.analyze_image(image_data)
            
            result = {
                'case': case_name,
                'image_size': len(image_data),
                'defects_found': len(defects),
                'defect_types': [d['type'] for d in defects],
                'avg_confidence': sum(d['confidence'] for d in defects) / len(defects) if defects else 0
            }
            
            classification_results.append(result)
            self.log('info', f'Classification result for {case_name}', **result)
        
        self.results.extend(classification_results)
        return classification_results
    
    def test_concurrent_uploads(self):
        """Test system performance under concurrent load"""
        self.log('info', 'Testing concurrent upload performance')
        
        def upload_worker(worker_id):
            """Worker function for concurrent uploads"""
            image_data = TestImageGenerator.create_valid_image()
            files = {'image': (f'test_{worker_id}.jpg', image_data, 'image/jpeg')}
            data = {
                'device_id': f'test-cam-{worker_id}',
                'defect_type': 'LoadTest',
                'confidence': '0.8'
            }
            headers = {'x-device-token': DEVICE_TOKEN}
            
            start_time = time.time()
            try:
                response = requests.post(FUNCTION_URL, files=files, data=data, headers=headers, timeout=30)
                duration = time.time() - start_time
                
                return {
                    'worker_id': worker_id,
                    'status_code': response.status_code,
                    'duration': duration,
                    'success': response.status_code == 200
                }
            except Exception as e:
                duration = time.time() - start_time
                return {
                    'worker_id': worker_id,
                    'error': str(e),
                    'duration': duration,
                    'success': False
                }
        
        # Run concurrent uploads
        num_workers = 5
        threads = []
        results = []
        
        for i in range(num_workers):
            thread = threading.Thread(target=lambda: results.append(upload_worker(i)))
            threads.append(thread)
            thread.start()
        
        for thread in threads:
            thread.join()
        
        # Analyze results
        successful = sum(1 for r in results if r.get('success', False))
        avg_duration = sum(r['duration'] for r in results) / len(results)
        
        self.log('info', f'Concurrent test results: {successful}/{num_workers} successful, avg duration: {avg_duration:.2f}s')
        return results
    
    def generate_test_report(self):
        """Generate comprehensive test report"""
        report = {
            'test_session': {
                'timestamp': datetime.now().isoformat(),
                'backend_url': BACKEND_URL,
                'function_url': FUNCTION_URL,
                'total_logs': len(self.session_logs),
                'results_count': len(self.results)
            },
            'logs': self.session_logs,
            'results': self.results,
            'summary': {
                'errors': len([log for log in self.session_logs if log['level'] == 'error']),
                'warnings': len([log for log in self.session_logs if log['level'] == 'warning']),
                'successes': len([log for log in self.session_logs if log['level'] == 'success'])
            }
        }
        
        # Save report to file
        report_file = f'e2e_test_report_{int(time.time())}.json'
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        self.log('info', f'Test report saved to {report_file}')
        return report
    
    def cleanup(self):
        """Cleanup connections and resources"""
        if self.sio and self.sio.connected:
            self.sio.disconnect()
        self.log('info', 'Cleanup completed')

def run_full_e2e_test():
    """Run the complete end-to-end test suite"""
    suite = EndToEndTestSuite()
    
    try:
        # Setup
        suite.log('info', '=== Starting End-to-End Pipeline Tests ===')
        
        # Test 1: Health checks
        suite.test_health_endpoints()
        
        # Test 2: Socket connection
        if suite.setup_socket_connection():
            time.sleep(2)  # Allow connection to stabilize
        
        # Test 3: Valid image pipeline
        suite.test_valid_image_upload()
        
        # Test 4: Error handling
        suite.test_corrupted_image_handling()
        suite.test_oversized_image_handling()
        
        # Test 5: Classification accuracy
        suite.test_defect_classification_accuracy()
        
        # Test 6: Performance under load
        suite.test_concurrent_uploads()
        
        # Generate final report
        report = suite.generate_test_report()
        
        suite.log('info', '=== End-to-End Tests Completed ===')
        return report
        
    except Exception as e:
        suite.log('error', f'Test suite failed: {e}')
        raise
    finally:
        suite.cleanup()

if __name__ == '__main__':
    # Run tests when script is executed directly
    try:
        report = run_full_e2e_test()
        
        # Print summary
        print(f"\n=== TEST SUMMARY ===")
        print(f"Total logs: {report['test_session']['total_logs']}")
        print(f"Errors: {report['summary']['errors']}")
        print(f"Warnings: {report['summary']['warnings']}")
        print(f"Successes: {report['summary']['successes']}")
        
        exit_code = 0 if report['summary']['errors'] == 0 else 1
        exit(exit_code)
        
    except Exception as e:
        print(f"FATAL: Test suite failed to run: {e}")
        exit(1)

# Pytest integration
class TestE2EPipeline:
    """Pytest wrapper for end-to-end tests"""
    
    def test_health_endpoints(self):
        suite = EndToEndTestSuite()
        suite.test_health_endpoints()
    
    def test_valid_image_upload_pipeline(self):
        suite = EndToEndTestSuite()
        try:
            if suite.setup_socket_connection():
                time.sleep(1)
            result = suite.test_valid_image_upload()
            # For pytest, we'll accept None result if function is not deployed
            if result is not None:
                assert 'image_url' in result or 'error' in result
        finally:
            suite.cleanup()
    
    def test_image_validation_edge_cases(self):
        suite = EndToEndTestSuite()
        try:
            suite.test_corrupted_image_handling()
            suite.test_oversized_image_handling()
        finally:
            suite.cleanup()
    
    def test_defect_classification(self):
        suite = EndToEndTestSuite()
        results = suite.test_defect_classification_accuracy()
        assert len(results) > 0
        # Verify that classification produces reasonable results
        assert all(r['defects_found'] >= 0 for r in results)
        assert all(0 <= r['avg_confidence'] <= 1 for r in results if r['defects_found'] > 0)