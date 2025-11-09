// Dashboard UI Defect Display Tests
// Tests for defect rendering, modal behavior, image error handling, and Supabase realtime integration

// Mock dependencies
jest.mock('../../components/Sidebar', () => ({ onLogout, mainItems, bottomItems }) => (
  <div data-testid="sidebar" />
));

// Mock Supabase properly
const mockSupabaseChannel = {
  on: jest.fn().mockReturnThis(),
  subscribe: jest.fn().mockReturnThis(),
  unsubscribe: jest.fn().mockReturnThis(),
};

jest.mock('../../supabase', () => ({
  signOutUser: jest.fn().mockResolvedValue(),
  supabase: {
    channel: jest.fn(() => mockSupabaseChannel),
    removeChannel: jest.fn(),
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
    }))
  }
}));

// Mock socket.io
const mockSocket = {
  emit: jest.fn(),
  on: jest.fn(),
  disconnect: jest.fn(),
};

beforeAll(() => {
  window.__IO__ = () => mockSocket;
  // Mock Supabase realtime enabled
  process.env.REACT_APP_ENABLE_SUPABASE_REALTIME = 'true';
  process.env.REACT_APP_SUPABASE_URL = 'https://test.supabase.co';
  process.env.REACT_APP_SUPABASE_ANON_KEY = 'test-key';
});

afterAll(() => {
  delete window.__IO__;
  delete process.env.REACT_APP_ENABLE_SUPABASE_REALTIME;
  delete process.env.REACT_APP_SUPABASE_URL;
  delete process.env.REACT_APP_SUPABASE_ANON_KEY;
});

import React from 'react';
import { render, screen, fireEvent, act, within, waitFor } from '@testing-library/react';
import Dashboard from '../Dashboard';
import { supabase } from '../../supabase';

function renderDashboard() {
  return render(<Dashboard />);
}

describe('Dashboard UI Defect Display Tests', () => {
  beforeEach(() => {
    // Reset all mocks
    mockSocket.emit.mockClear();
    mockSocket.on.mockClear();
    mockSocket.disconnect.mockClear();
    mockSupabaseChannel.on.mockClear();
    mockSupabaseChannel.subscribe.mockClear();
    mockSupabaseChannel.unsubscribe.mockClear();
    supabase.channel.mockReturnValue(mockSupabaseChannel);
    sessionStorage.clear();
  });

  function getSocketHandler(event) {
    const call = mockSocket.on.mock.calls.find(([evt]) => evt === event);
    return call ? call[1] : undefined;
  }

  function getSupabaseHandler(event) {
    const call = mockSupabaseChannel.on.mock.calls.find(([evt]) => evt === event);
    return call ? call[1] : undefined;
  }

  describe('Defect Display and Modal Behavior', () => {
    test('displays defects with proper formatting from Supabase realtime', async () => {
      renderDashboard();
      fireEvent.click(screen.getByRole('button', { name: /start detection/i }));
      
      // Get Supabase INSERT handler
      const insertHandler = getSupabaseHandler('postgres_changes');
      expect(insertHandler).toBeInstanceOf(Function);

      // Simulate Supabase defect insertion
      const mockDefect = {
        id: 'def-123',
        defect_type: 'Crack',
        image_url: 'https://supabase.local/storage/v1/object/public/defects/test.jpg',
        created_at: new Date().toISOString(),
        time_text: 'just now',
        confidence: 0.95,
        location: 'center'
      };

      await act(async () => {
        insertHandler({ new: mockDefect });
      });

      // Verify defect is displayed correctly
      expect(screen.getByText(/Glass Defect:/i)).toBeInTheDocument();
      expect(screen.getByText('Crack')).toBeInTheDocument();
      expect(screen.getByText('just now')).toBeInTheDocument();
      expect(screen.getByText('Image')).toBeInTheDocument();
    });

    test('opens modal with correct defect information', async () => {
      renderDashboard();
      fireEvent.click(screen.getByRole('button', { name: /start detection/i }));
      
      const insertHandler = getSupabaseHandler('postgres_changes');
      const mockDefect = {
        id: 'def-456',
        defect_type: 'Bubble',
        image_url: 'https://supabase.local/storage/v1/object/public/defects/bubble.jpg',
        created_at: new Date().toISOString(),
        time_text: '2 minutes ago',
        confidence: 0.87,
        location: 'top-left'
      };

      await act(async () => {
        insertHandler({ new: mockDefect });
      });

      // Click image to open modal
      fireEvent.click(screen.getByText('Image'));

      // Verify modal content
      const modal = document.querySelector('.modal');
      expect(modal).toBeTruthy();
      expect(within(modal).getByText('Bubble')).toBeInTheDocument();
      expect(within(modal).getByText('2 minutes ago')).toBeInTheDocument();
      
      // Check if image URL is displayed (in smaller gray text)
      const urlElement = within(modal).getByText((content, element) => 
        element && element.textContent.includes('bubble.jpg')
      );
      expect(urlElement).toBeInTheDocument();
      expect(urlElement).toHaveClass('text-xs', 'text-gray-500');
    });

    test('handles multiple defects and modal navigation', async () => {
      renderDashboard();
      fireEvent.click(screen.getByRole('button', { name: /start detection/i }));
      
      const insertHandler = getSupabaseHandler('postgres_changes');
      
      // Add multiple defects
      const defects = [
        { id: 'def-1', defect_type: 'Crack', image_url: 'test1.jpg', time_text: '1 min ago' },
        { id: 'def-2', defect_type: 'Scratch', image_url: 'test2.jpg', time_text: '2 min ago' },
        { id: 'def-3', defect_type: 'Bubble', image_url: 'test3.jpg', time_text: '3 min ago' }
      ];

      for (const defect of defects) {
        await act(async () => {
          insertHandler({ new: defect });
        });
      }

      // Open first defect modal
      const imageLinks = screen.getAllByText('Image');
      fireEvent.click(imageLinks[0]);

      const modal = document.querySelector('.modal');
      expect(within(modal).getByText('Crack')).toBeInTheDocument();

      // Test Next button if available
      const nextButton = screen.queryByRole('button', { name: /next/i });
      if (nextButton) {
        fireEvent.click(nextButton);
        expect(within(modal).getByText('Scratch')).toBeInTheDocument();

        // Test Previous button
        const prevButton = screen.queryByRole('button', { name: /prev/i });
        if (prevButton) {
          fireEvent.click(prevButton);
          expect(within(modal).getByText('Crack')).toBeInTheDocument();
        }
      }
    });
  });

  describe('Image Error Handling', () => {
    test('handles corrupted image URLs gracefully', async () => {
      renderDashboard();
      fireEvent.click(screen.getByRole('button', { name: /start detection/i }));
      
      const insertHandler = getSupabaseHandler('postgres_changes');
      const corruptedDefect = {
        id: 'def-corrupt',
        defect_type: 'Crack',
        image_url: 'https://invalid-domain.fake/corrupt.jpg',
        time_text: 'now',
        created_at: new Date().toISOString()
      };

      await act(async () => {
        insertHandler({ new: corruptedDefect });
      });

      // Defect should still be displayed
      expect(screen.getByText('Crack')).toBeInTheDocument();
      expect(screen.getByText('Image')).toBeInTheDocument();

      // Click to open modal with corrupted image
      fireEvent.click(screen.getByText('Image'));
      
      const modal = document.querySelector('.modal');
      expect(modal).toBeTruthy();
      
      // Should show defect info even if image fails to load
      expect(within(modal).getByText('Crack')).toBeInTheDocument();
      expect(within(modal).getByText('now')).toBeInTheDocument();
    });

    test('handles missing image URLs', async () => {
      renderDashboard();
      fireEvent.click(screen.getByRole('button', { name: /start detection/i }));
      
      const insertHandler = getSupabaseHandler('postgres_changes');
      const noImageDefect = {
        id: 'def-no-img',
        defect_type: 'Scratch',
        image_url: null,
        time_text: 'just now',
        created_at: new Date().toISOString()
      };

      await act(async () => {
        insertHandler({ new: noImageDefect });
      });

      // Should still display defect
      expect(screen.getByText('Scratch')).toBeInTheDocument();
      expect(screen.getByText('Image')).toBeInTheDocument();
    });

    test('handles malformed defect data', async () => {
      renderDashboard();
      fireEvent.click(screen.getByRole('button', { name: /start detection/i }));
      
      const insertHandler = getSupabaseHandler('postgres_changes');
      
      // Test with missing required fields
      const malformedDefect = {
        id: 'def-malformed',
        // missing defect_type
        image_url: 'test.jpg',
        // missing time_text
        created_at: new Date().toISOString()
      };

      await act(async () => {
        insertHandler({ new: malformedDefect });
      });

      // Should handle gracefully with fallback values
      expect(screen.getByText(/Glass Defect:/i)).toBeInTheDocument();
      expect(screen.getByText('Image')).toBeInTheDocument();
    });
  });

  describe('Live Stream Integration', () => {
    test('displays live stream frames while receiving defects from Supabase', async () => {
      renderDashboard();
      fireEvent.click(screen.getByRole('button', { name: /start detection/i }));
      
      // Simulate live stream frame
      const frameHandler = getSocketHandler('stream:frame');
      await act(async () => {
        frameHandler({
          dataUrl: 'data:image/jpeg;base64,test123',
          defects: [] // Empty since Supabase handles defects
        });
      });

      // Should show live feed image
      const liveImage = await screen.findByAltText('Live feed');
      expect(liveImage).toHaveAttribute('src', 'data:image/jpeg;base64,test123');

      // Add defect via Supabase
      const insertHandler = getSupabaseHandler('postgres_changes');
      await act(async () => {
        insertHandler({
          new: {
            id: 'def-live',
            defect_type: 'Pit',
            image_url: 'live-defect.jpg',
            time_text: 'live detection',
            created_at: new Date().toISOString()
          }
        });
      });

      // Should show both live stream and defect
      expect(liveImage).toBeInTheDocument();
      expect(screen.getByText('Pit')).toBeInTheDocument();
    });

    test('pauses defect collection when detection is paused', async () => {
      renderDashboard();
      fireEvent.click(screen.getByRole('button', { name: /start detection/i }));
      
      // Pause detection
      fireEvent.click(screen.getByRole('button', { name: /pause/i }));

      // Try to add defect while paused
      const insertHandler = getSupabaseHandler('postgres_changes');
      await act(async () => {
        insertHandler({
          new: {
            id: 'def-paused',
            defect_type: 'Crack',
            image_url: 'paused.jpg',
            time_text: 'paused state',
            created_at: new Date().toISOString()
          }
        });
      });

      // Should not show defect while paused
      expect(screen.queryByText('Crack')).not.toBeInTheDocument();
      expect(screen.getByText('No detections yet')).toBeInTheDocument();

      // Resume and add defect
      fireEvent.click(screen.getByRole('button', { name: /resume/i }));
      await act(async () => {
        insertHandler({
          new: {
            id: 'def-resumed',
            defect_type: 'Bubble',
            image_url: 'resumed.jpg',
            time_text: 'after resume',
            created_at: new Date().toISOString()
          }
        });
      });

      // Should show defect after resume
      expect(screen.getByText('Bubble')).toBeInTheDocument();
    });
  });

  describe('Performance and Edge Cases', () => {
    test('limits defects list to prevent memory issues', async () => {
      renderDashboard();
      fireEvent.click(screen.getByRole('button', { name: /start detection/i }));
      
      const insertHandler = getSupabaseHandler('postgres_changes');
      
      // Add more than 20 defects (the limit)
      for (let i = 1; i <= 25; i++) {
        await act(async () => {
          insertHandler({
            new: {
              id: `def-${i}`,
              defect_type: `Defect${i}`,
              image_url: `test${i}.jpg`,
              time_text: `${i} min ago`,
              created_at: new Date().toISOString()
            }
          });
        });
      }

      // Should only show last 20 defects
      expect(screen.queryByText('Defect1')).not.toBeInTheDocument(); // First ones removed
      expect(screen.getByText('Defect25')).toBeInTheDocument(); // Latest should be there
      
      // Count actual defect entries
      const defectEntries = screen.getAllByText(/Glass Defect:/i);
      expect(defectEntries.length).toBeLessThanOrEqual(20);
    });

    test('handles rapid defect insertions without UI lag', async () => {
      renderDashboard();
      fireEvent.click(screen.getByRole('button', { name: /start detection/i }));
      
      const insertHandler = getSupabaseHandler('postgres_changes');
      
      // Rapidly add multiple defects
      const rapidDefects = Array.from({ length: 10 }, (_, i) => ({
        id: `rapid-${i}`,
        defect_type: 'RapidDefect',
        image_url: `rapid${i}.jpg`,
        time_text: `rapid ${i}`,
        created_at: new Date().toISOString()
      }));

      await act(async () => {
        rapidDefects.forEach(defect => {
          insertHandler({ new: defect });
        });
      });

      // All should be displayed
      const defectEntries = screen.getAllByText('RapidDefect');
      expect(defectEntries.length).toBe(10);
    });
  });
});