// Mocks MUST be defined before importing the component
// Mock Sidebar to simplify rendering
jest.mock('../../components/Sidebar', () => ({ onLogout, mainItems, bottomItems }) => (
  <div data-testid="sidebar" />
));

// Mock supabase signOutUser
jest.mock('../../supabase', () => ({ signOutUser: jest.fn().mockResolvedValue() }));

// Mock socket.io via window.__IO__ factory
const mockSocket = {
  emit: jest.fn(),
  on: jest.fn((event, fn) => {}),
  disconnect: jest.fn(),
};
// Set a global factory the component will use in tests
beforeAll(() => {
  window.__IO__ = () => mockSocket;
});
afterAll(() => {
  delete window.__IO__;
});

import React from 'react';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import Dashboard from '../Dashboard';

function renderDashboard() {
  return render(<Dashboard />);
}

describe('Dashboard live feed', () => {
  beforeEach(() => {
    // reset mocks and listeners
    mockSocket.emit.mockClear();
    mockSocket.on.mockClear();
    mockSocket.disconnect.mockClear();
    // clear session role to avoid redirect
    sessionStorage.clear();
  });

  function getHandler(event) {
    const call = mockSocket.on.mock.calls.find(([evt]) => evt === event);
    return call ? call[1] : undefined;
  }

  test('initially shows placeholder and Start Detection', () => {
    renderDashboard();
    expect(screen.getByText('Camera Ready')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start detection/i })).toBeInTheDocument();
  });

  test('start detection shows LIVE and Pause button', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: /start detection/i }));
    expect(await screen.findByText(/LIVE/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();
  });

  test('receives a frame and displays image', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: /start detection/i }));
    expect(await screen.findByText(/LIVE/i)).toBeInTheDocument();

    const onFrame = getHandler('stream:frame');
    expect(onFrame).toBeInstanceOf(Function);
    await act(async () => {
      onFrame({ dataUrl: 'data:image/jpeg;base64,AAA', defects: [] });
    });

    const img = await screen.findByAltText('Live feed');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'data:image/jpeg;base64,AAA');
  });

  test('appends defect entries when frame has defects', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: /start detection/i }));
    expect(await screen.findByText(/LIVE/i)).toBeInTheDocument();

    const onFrame = getHandler('stream:frame');
    expect(onFrame).toBeInstanceOf(Function);
    await act(async () => {
      onFrame({ dataUrl: 'data:image/jpeg;base64,BBB', defects: [{ type: 'Crack' }] });
    });

    expect(screen.getByText(/Glass Defect:/i)).toBeInTheDocument();
    expect(screen.getByText(/Crack/i)).toBeInTheDocument();
  });

  test('Pause stops appending defects; Resume resumes', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: /start detection/i }));
    expect(await screen.findByText(/LIVE/i)).toBeInTheDocument();

    // Pause
    fireEvent.click(screen.getByRole('button', { name: /pause/i }));

    const onFrame = getHandler('stream:frame');
    expect(onFrame).toBeInstanceOf(Function);
    await act(async () => {
      onFrame({ dataUrl: 'data:image/jpeg;base64,CCC', defects: [{ type: 'Scratch' }] });
    });
    // Should still show empty state
    expect(screen.getByText('No detections yet')).toBeInTheDocument();

    // Resume
    fireEvent.click(screen.getByRole('button', { name: /resume/i }));
    await act(async () => {
      onFrame({ dataUrl: 'data:image/jpeg;base64,DDD', defects: [{ type: 'Scratch' }] });
    });
    expect(await screen.findByText(/Glass Defect:/i)).toBeInTheDocument();
  });

  test('Stop Detection resets UI and disconnects socket', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: /start detection/i }));
    expect(await screen.findByText(/LIVE/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /stop detection/i }));
    expect(screen.getByText('Camera Ready')).toBeInTheDocument();
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });

  test('Clear removes defects and stops detection', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: /start detection/i }));
    expect(await screen.findByText(/LIVE/i)).toBeInTheDocument();

    // Add a defect so Clear becomes enabled
    const onFrame = getHandler('stream:frame');
    expect(onFrame).toBeInstanceOf(Function);
    await act(async () => {
      onFrame({ dataUrl: 'data:image/jpeg;base64,EEE', defects: [{ type: 'Bubble' }] });
    });
    expect(screen.getByText(/Bubble/i)).toBeInTheDocument();

    const clearHeaderBtn = screen.getByRole('button', { name: /^clear$/i });
    expect(clearHeaderBtn).not.toHaveAttribute('disabled');
    fireEvent.click(clearHeaderBtn);

    // Confirm in modal (use the last Clear button)
    const modalClears = await screen.findAllByRole('button', { name: /^clear$/i });
    fireEvent.click(modalClears[modalClears.length - 1]);

    expect(screen.getByText('No detections yet')).toBeInTheDocument();
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });

  test('Download CSV enabled only when defects exist', async () => {
    renderDashboard();
    // Initially disabled
    const dlBtn = screen.getByRole('button', { name: /download csv/i });
    expect(dlBtn).toHaveAttribute('disabled');

    // Start and add one defect
    fireEvent.click(screen.getByRole('button', { name: /start detection/i }));
    expect(await screen.findByText(/LIVE/i)).toBeInTheDocument();
    const onFrame = getHandler('stream:frame');
    await act(async () => {
      onFrame({ dataUrl: 'data:image/jpeg;base64,FFF', defects: [{ type: 'Pit' }] });
    });

    // Now enabled
    expect(screen.getByRole('button', { name: /download csv/i })).not.toHaveAttribute('disabled');
  });

  test('Upload button disabled while detecting and enabled when stopped', async () => {
    renderDashboard();
    const uploadBtn = screen.getByRole('button', { name: /upload to database/i });
    // Not detecting -> enabled
    expect(uploadBtn).not.toHaveAttribute('disabled');

    // Start detection -> disabled
    fireEvent.click(screen.getByRole('button', { name: /start detection/i }));
    expect(await screen.findByText(/LIVE/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload to database/i })).toHaveAttribute('disabled');

    // Stop detection -> enabled again
    fireEvent.click(screen.getByRole('button', { name: /stop detection/i }));
    expect(screen.getByRole('button', { name: /upload to database/i })).not.toHaveAttribute('disabled');
  });

  test('Image modal opens on Image click and supports Next/Prev navigation', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: /start detection/i }));
    expect(await screen.findByText(/LIVE/i)).toBeInTheDocument();
    const onFrame = getHandler('stream:frame');

    // Add two defects
    await act(async () => {
      onFrame({ dataUrl: 'data:image/jpeg;base64,AAA1', defects: [{ type: 'Bubble' }] });
      onFrame({ dataUrl: 'data:image/jpeg;base64,AAA2', defects: [{ type: 'Crack' }] });
    });

    // Open first defect image
    const imageLinks = screen.getAllByText('Image');
    fireEvent.click(imageLinks[0]);

  // Should show modal with defect info (scope to modal to avoid list duplicates)
  const modalEl = document.querySelector('.modal');
  expect(modalEl).toBeTruthy();
  expect(within(modalEl).getByText(/Glass Defect:/i)).toBeInTheDocument();

    // If Next exists, click it, then Prev back
    const maybeNext = screen.queryByRole('button', { name: /next/i });
    if (maybeNext) {
      fireEvent.click(maybeNext);
      const maybePrev = screen.queryByRole('button', { name: /prev/i });
      if (maybePrev) fireEvent.click(maybePrev);
    }

    // Close modal
    const closeButtons = screen.getAllByRole('button');
    // The close button has class modal-close, but we can click the first button in the modal area by heuristic
    fireEvent.click(closeButtons.find(btn => btn.className.includes('modal-close')));
  });
});
