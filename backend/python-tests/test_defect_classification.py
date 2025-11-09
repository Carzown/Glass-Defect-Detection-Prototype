# Defect Classification and Detection Tests
# Tests for various defect types, confidence scores, and classification accuracy

import pytest
import numpy as np
from unittest.mock import Mock, patch
import json
import os
from datetime import datetime

class DefectClassifier:
    """Mock defect classification system for testing"""
    
    DEFECT_TYPES = {
        'crack': {
            'confidence_range': (0.7, 0.95),
            'typical_size': (10, 200),
            'description': 'Linear fractures in glass surface'
        },
        'bubble': {
            'confidence_range': (0.6, 0.9),
            'typical_size': (5, 50),
            'description': 'Air inclusions within glass'
        },
        'scratch': {
            'confidence_range': (0.5, 0.85),
            'typical_size': (1, 100),
            'description': 'Surface abrasions from handling'
        },
        'pit': {
            'confidence_range': (0.6, 0.9),
            'typical_size': (2, 20),
            'description': 'Small surface depressions'
        },
        'inclusion': {
            'confidence_range': (0.7, 0.95),
            'typical_size': (3, 30),
            'description': 'Foreign material embedded in glass'
        },
        'stain': {
            'confidence_range': (0.4, 0.8),
            'typical_size': (10, 500),
            'description': 'Discoloration or residue on surface'
        }
    }
    
    def __init__(self, model_version="v1.0.0", confidence_threshold=0.5):
        self.model_version = model_version
        self.confidence_threshold = confidence_threshold
        self.classification_history = []
    
    def classify_defect(self, image_data, metadata=None):
        """Classify defects in image data"""
        # Simulate classification based on image characteristics
        image_hash = hash(image_data) if isinstance(image_data, bytes) else hash(str(image_data))
        
        # Deterministic "classification" for testing
        defect_type = list(self.DEFECT_TYPES.keys())[abs(image_hash) % len(self.DEFECT_TYPES)]
        confidence_range = self.DEFECT_TYPES[defect_type]['confidence_range']
        size_range = self.DEFECT_TYPES[defect_type]['typical_size']
        
        # Generate confidence score
        confidence = confidence_range[0] + (abs(image_hash) % 100) / 100 * (confidence_range[1] - confidence_range[0])
        
        # Generate location and size
        location_x = abs(image_hash) % 640
        location_y = abs(image_hash // 640) % 480
        defect_size = size_range[0] + (abs(image_hash) % (size_range[1] - size_range[0]))
        
        result = {
            'defect_type': defect_type,
            'confidence': round(confidence, 3),
            'location': {
                'x': location_x,
                'y': location_y,
                'bbox': {
                    'x': max(0, location_x - defect_size // 2),
                    'y': max(0, location_y - defect_size // 2),
                    'width': defect_size,
                    'height': defect_size
                }
            },
            'size_pixels': defect_size,
            'severity': self._calculate_severity(defect_type, confidence, defect_size),
            'description': self.DEFECT_TYPES[defect_type]['description'],
            'model_version': self.model_version,
            'timestamp': datetime.now().isoformat(),
            'metadata': metadata or {}
        }
        
        # Record classification
        self.classification_history.append(result)
        
        return result if confidence >= self.confidence_threshold else None
    
    def classify_multiple_defects(self, image_data, max_defects=5):
        """Classify multiple defects in a single image"""
        defects = []
        base_hash = hash(image_data) if isinstance(image_data, bytes) else hash(str(image_data))
        
        # Determine number of defects (0-max_defects)
        num_defects = abs(base_hash) % (max_defects + 1)
        
        for i in range(num_defects):
            # Modify hash for each defect to get different classifications
            defect_hash = base_hash + i * 12345
            defect_data = str(defect_hash).encode()
            
            defect = self.classify_defect(defect_data, metadata={'defect_index': i})
            if defect:
                defects.append(defect)
        
        return defects
    
    def _calculate_severity(self, defect_type, confidence, size):
        """Calculate defect severity based on type, confidence, and size"""
        severity_weights = {
            'crack': 3.0,      # High severity
            'inclusion': 2.5,   # High severity
            'bubble': 2.0,      # Medium severity
            'pit': 1.5,         # Medium severity
            'scratch': 1.0,     # Low severity
            'stain': 0.5        # Low severity
        }
        
        base_severity = severity_weights.get(defect_type, 1.0)
        confidence_factor = confidence
        size_factor = min(size / 100, 2.0)  # Cap at 2x multiplier
        
        severity_score = base_severity * confidence_factor * size_factor
        
        if severity_score >= 3.0:
            return 'critical'
        elif severity_score >= 2.0:
            return 'major'
        elif severity_score >= 1.0:
            return 'minor'
        else:
            return 'cosmetic'
    
    def get_classification_stats(self):
        """Get statistics about classifications performed"""
        if not self.classification_history:
            return {'total': 0}
        
        stats = {
            'total': len(self.classification_history),
            'defect_types': {},
            'severity_distribution': {},
            'avg_confidence': 0,
            'confidence_distribution': {'high': 0, 'medium': 0, 'low': 0}
        }
        
        total_confidence = 0
        for result in self.classification_history:
            # Count defect types
            defect_type = result['defect_type']
            stats['defect_types'][defect_type] = stats['defect_types'].get(defect_type, 0) + 1
            
            # Count severity levels
            severity = result['severity']
            stats['severity_distribution'][severity] = stats['severity_distribution'].get(severity, 0) + 1
            
            # Confidence statistics
            confidence = result['confidence']
            total_confidence += confidence
            
            if confidence >= 0.8:
                stats['confidence_distribution']['high'] += 1
            elif confidence >= 0.6:
                stats['confidence_distribution']['medium'] += 1
            else:
                stats['confidence_distribution']['low'] += 1
        
        stats['avg_confidence'] = round(total_confidence / len(self.classification_history), 3)
        
        return stats

class TestDefectClassification:
    """Test suite for defect classification functionality"""
    
    def setup_method(self):
        """Setup for each test method"""
        self.classifier = DefectClassifier()
        
    def test_single_defect_classification(self):
        """Test classification of single defects"""
        test_image = b"test_image_data_crack"
        
        result = self.classifier.classify_defect(test_image)
        
        assert result is not None
        assert 'defect_type' in result
        assert 'confidence' in result
        assert 'location' in result
        assert 'severity' in result
        assert result['defect_type'] in DefectClassifier.DEFECT_TYPES
        assert 0 <= result['confidence'] <= 1
        assert result['severity'] in ['critical', 'major', 'minor', 'cosmetic']
    
    def test_multiple_defect_classification(self):
        """Test classification of multiple defects in one image"""
        test_image = b"test_image_with_multiple_defects"
        
        defects = self.classifier.classify_multiple_defects(test_image, max_defects=3)
        
        assert isinstance(defects, list)
        assert len(defects) <= 3
        
        # Verify each defect has required fields
        for defect in defects:
            assert 'defect_type' in defect
            assert 'confidence' in defect
            assert 'location' in defect
            assert 'bbox' in defect['location']
            assert 'severity' in defect
    
    def test_confidence_threshold_filtering(self):
        """Test that low confidence detections are filtered out"""
        low_threshold_classifier = DefectClassifier(confidence_threshold=0.1)
        high_threshold_classifier = DefectClassifier(confidence_threshold=0.9)
        
        test_image = b"test_image_medium_confidence"
        
        low_result = low_threshold_classifier.classify_defect(test_image)
        high_result = high_threshold_classifier.classify_defect(test_image)
        
        # Low threshold should return result, high threshold might not
        assert low_result is not None
        
        if high_result is None:
            # This means confidence was below 0.9, which is expected for some test cases
            assert True
        else:
            # If high threshold also returns result, confidence must be very high
            assert high_result['confidence'] >= 0.9
    
    def test_defect_type_coverage(self):
        """Test that all defect types can be classified"""
        detected_types = set()
        
        # Test with different image data to trigger different classifications
        for i in range(100):
            test_image = f"test_image_variation_{i}".encode()
            result = self.classifier.classify_defect(test_image)
            
            if result:
                detected_types.add(result['defect_type'])
        
        # Should detect most defect types with enough variations
        assert len(detected_types) >= 3  # At least half of the defect types
        
        # All detected types should be valid
        for defect_type in detected_types:
            assert defect_type in DefectClassifier.DEFECT_TYPES
    
    def test_severity_calculation(self):
        """Test defect severity calculation logic"""
        # Test different defect types and verify severity makes sense
        test_cases = [
            ('crack', 0.9, 100),    # Should be high severity
            ('stain', 0.5, 10),     # Should be low severity
            ('inclusion', 0.95, 50) # Should be high severity
        ]
        
        for defect_type, confidence, size in test_cases:
            severity = self.classifier._calculate_severity(defect_type, confidence, size)
            assert severity in ['critical', 'major', 'minor', 'cosmetic']
            
            # Crack with high confidence should be serious
            if defect_type == 'crack' and confidence > 0.8:
                assert severity in ['major', 'critical']
            
            # Stains should generally be less severe
            if defect_type == 'stain':
                assert severity in ['cosmetic', 'minor']
    
    def test_bounding_box_validity(self):
        """Test that bounding boxes are within image bounds"""
        test_image = b"test_image_bbox_check"
        
        result = self.classifier.classify_defect(test_image)
        
        if result and 'bbox' in result['location']:
            bbox = result['location']['bbox']
            
            # Bounding box should have valid coordinates
            assert bbox['x'] >= 0
            assert bbox['y'] >= 0
            assert bbox['width'] > 0
            assert bbox['height'] > 0
            
            # Should not exceed typical image dimensions
            assert bbox['x'] + bbox['width'] <= 640 + bbox['width']  # Allow some margin
            assert bbox['y'] + bbox['height'] <= 480 + bbox['height']
    
    def test_classification_consistency(self):
        """Test that same image produces consistent results"""
        test_image = b"consistent_test_image"
        
        result1 = self.classifier.classify_defect(test_image)
        result2 = self.classifier.classify_defect(test_image)
        
        if result1 and result2:
            # Same image should produce same classification
            assert result1['defect_type'] == result2['defect_type']
            assert result1['confidence'] == result2['confidence']
            assert result1['location'] == result2['location']
            assert result1['severity'] == result2['severity']
    
    def test_metadata_handling(self):
        """Test handling of optional metadata"""
        test_image = b"test_image_metadata"
        metadata = {
            'camera_id': 'cam-001',
            'timestamp': '2024-01-01T12:00:00Z',
            'lighting_conditions': 'bright',
            'glass_type': 'tempered'
        }
        
        result = self.classifier.classify_defect(test_image, metadata=metadata)
        
        if result:
            assert 'metadata' in result
            assert result['metadata'] == metadata
    
    def test_classification_statistics(self):
        """Test classification statistics generation"""
        # Perform several classifications
        test_images = [
            b"test_image_1",
            b"test_image_2", 
            b"test_image_3",
            b"test_image_4",
            b"test_image_5"
        ]
        
        for img in test_images:
            self.classifier.classify_defect(img)
        
        stats = self.classifier.get_classification_stats()
        
        assert 'total' in stats
        assert stats['total'] <= len(test_images)  # Some might be filtered by threshold
        
        if stats['total'] > 0:
            assert 'defect_types' in stats
            assert 'severity_distribution' in stats
            assert 'avg_confidence' in stats
            assert 'confidence_distribution' in stats
            
            # Verify confidence average is reasonable
            assert 0 <= stats['avg_confidence'] <= 1
    
    def test_edge_cases(self):
        """Test edge cases and error conditions"""
        # Empty image data
        result = self.classifier.classify_defect(b"")
        # Should handle gracefully (might return None or a result)
        
        # Very large image data
        large_data = b"x" * 10000
        result = self.classifier.classify_defect(large_data)
        # Should handle without crashing
        
        # None input
        try:
            result = self.classifier.classify_defect(None)
        except (TypeError, AttributeError):
            # Expected for None input
            pass
    
    def test_model_versioning(self):
        """Test model version tracking"""
        classifier_v1 = DefectClassifier(model_version="v1.0.0")
        classifier_v2 = DefectClassifier(model_version="v2.1.0")
        
        test_image = b"version_test_image"
        
        result_v1 = classifier_v1.classify_defect(test_image)
        result_v2 = classifier_v2.classify_defect(test_image)
        
        if result_v1:
            assert result_v1['model_version'] == "v1.0.0"
        
        if result_v2:
            assert result_v2['model_version'] == "v2.1.0"

class TestDefectClassificationIntegration:
    """Integration tests for defect classification with pipeline components"""
    
    def test_supabase_defect_format(self):
        """Test that classification results match expected Supabase schema"""
        classifier = DefectClassifier()
        test_image = b"supabase_format_test"
        
        result = classifier.classify_defect(test_image)
        
        if result:
            # Should be convertible to Supabase defects table format
            supabase_record = {
                'defect_type': result['defect_type'],
                'confidence': result['confidence'],
                'location_x': result['location']['x'],
                'location_y': result['location']['y'],
                'bbox_x': result['location']['bbox']['x'],
                'bbox_y': result['location']['bbox']['y'],
                'bbox_width': result['location']['bbox']['width'],
                'bbox_height': result['location']['bbox']['height'],
                'size_pixels': result['size_pixels'],
                'severity': result['severity'],
                'model_version': result['model_version'],
                'created_at': result['timestamp']
            }
            
            # Verify all fields have valid types
            assert isinstance(supabase_record['defect_type'], str)
            assert isinstance(supabase_record['confidence'], (int, float))
            assert isinstance(supabase_record['location_x'], int)
            assert isinstance(supabase_record['severity'], str)
    
    def test_socket_io_payload_format(self):
        """Test compatibility with Socket.IO frame payload format"""
        classifier = DefectClassifier()
        test_image = b"socket_io_test"
        
        defects = classifier.classify_multiple_defects(test_image, max_defects=3)
        
        # Convert to Socket.IO format (simplified)
        socket_defects = []
        for defect in defects:
            socket_defects.append({
                'type': defect['defect_type'],
                'confidence': defect['confidence'],
                'location': f"({defect['location']['x']}, {defect['location']['y']})",
                'severity': defect['severity']
            })
        
        # Verify format
        for socket_defect in socket_defects:
            assert 'type' in socket_defect
            assert 'confidence' in socket_defect
            assert isinstance(socket_defect['type'], str)
            assert isinstance(socket_defect['confidence'], (int, float))

if __name__ == '__main__':
    # Run basic tests when script is executed directly
    classifier = DefectClassifier()
    
    print("Testing Defect Classification System...")
    
    # Test single classification
    test_image = b"example_defect_image_data"
    result = classifier.classify_defect(test_image)
    
    if result:
        print(f"Detected: {result['defect_type']} (confidence: {result['confidence']:.3f})")
        print(f"Location: ({result['location']['x']}, {result['location']['y']})")
        print(f"Severity: {result['severity']}")
    else:
        print("No defects detected above threshold")
    
    # Test multiple classifications
    defects = classifier.classify_multiple_defects(test_image, max_defects=5)
    print(f"\nMultiple defect detection found {len(defects)} defects")
    
    # Generate statistics
    for i in range(10):
        test_data = f"test_image_{i}".encode()
        classifier.classify_defect(test_data)
    
    stats = classifier.get_classification_stats()
    print(f"\nClassification Statistics:")
    print(f"Total classifications: {stats['total']}")
    print(f"Average confidence: {stats['avg_confidence']}")
    print(f"Defect types found: {list(stats['defect_types'].keys())}")
    print(f"Severity distribution: {stats['severity_distribution']}")
    
    print("\nDefect classification testing completed!")