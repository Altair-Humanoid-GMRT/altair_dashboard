'use client';
import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';

export default function MonitoredMarkerMap() {
  const mapRef = useRef(null);
  const [markers, setMarkers] = useState([]);
  const [isReady, setIsReady] = useState(false);

  // Add new marker
  const addMarker = (x, y) => {
    if (!mapRef.current || !isReady) return;
    
    const rect = mapRef.current.getBoundingClientRect();
    const img = mapRef.current.querySelector('img');
    const imgWidth = img.clientWidth;
    const imgHeight = img.clientHeight;
    
    // Boundary checks
    const maxX = imgWidth / 2 - 10;
    const maxY = imgHeight / 2 - 10;
    
    const newMarker = {
      id: Date.now(),
      x: Math.max(-maxX, Math.min(x, maxX)),
      y: Math.max(-maxY, Math.min(y, maxY)),
      color: `hsl(${Math.random() * 360}, 70%, 50%)`,
      timestamp: new Date().toLocaleTimeString(),
      status: 'Active'
    };
    
    setMarkers(prev => [...prev, newMarker]);
  };

  // Remove marker
  const removeMarker = (id) => {
    setMarkers(prev => prev.map(m => 
      m.id === id ? { ...m, status: 'Removed' } : m
    ));
    
    setTimeout(() => {
      setMarkers(prev => prev.filter(m => m.id !== id));
    }, 500);
  };

  // Toggle marker status
  const toggleMarker = (id) => {
    setMarkers(prev => prev.map(marker =>
      marker.id === id
        ? { 
            ...marker, 
            status: marker.status === 'Active' ? 'Inactive' : 'Active',
            color: marker.status === 'Active' 
              ? `hsl(0, 70%, 50%)` 
              : `hsl(${Math.random() * 360}, 70%, 50%)`
          }
        : marker
    ));
  };

  return (
    <div style={styles.container}>
      {/* Map Container */}
      <div ref={mapRef} style={styles.mapWrapper}>
        <Image
          src="/map.png"
          alt="Map"
          fill
          style={styles.mapImage}
          priority
          onLoadingComplete={() => setIsReady(true)}
        />

        {isReady && markers.map(marker => (
          <div
            key={marker.id}
            style={{
              ...styles.marker,
              transform: `translate(
                calc(-50% + ${marker.x}px),
                calc(-50% - ${marker.y}px)
              )`,
              backgroundColor: marker.color,
              opacity: marker.status === 'Removed' ? 0 : 1,
              transition: 'all 0.3s ease'
            }}
            onClick={() => toggleMarker(marker.id)}
          />
        ))}
      </div>

      {/* Control Panel */}
      <div style={styles.controlPanel}>
        <button 
          onClick={() => addMarker(0, 0)}
          style={styles.button}
        >
          Add Center Marker
        </button>
        <button
          onClick={() => addMarker(
            Math.floor(Math.random() * 300 - 150),
            Math.floor(Math.random() * 200 - 100)
          )}
          style={styles.button}
        >
          Add Random Marker
        </button>
      </div>

      {/* Marker Monitoring Panel */}
      <div style={styles.monitoringPanel}>
        <h3 style={styles.panelTitle}>Marker Monitoring</h3>
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Position (X,Y)</th>
                <th>Status</th>
                <th>Timestamp</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {markers.map(marker => (
                <tr key={marker.id} style={{
                  ...styles.tableRow,
                  background: marker.status === 'Inactive' ? '#f5f5f5' : 'white',
                  color: marker.status === 'Inactive' ? '#999' : 'inherit'
                }}>
                  <td>{marker.id.toString().slice(-4)}</td>
                  <td>({marker.x.toFixed(0)}, {marker.y.toFixed(0)})</td>
                  <td>
                    <span style={{
                      color: marker.status === 'Active' ? 'green' : 'red',
                      fontWeight: 'bold'
                    }}>
                      {marker.status}
                    </span>
                  </td>
                  <td>{marker.timestamp}</td>
                  <td>
                    <button 
                      onClick={() => toggleMarker(marker.id)}
                      style={styles.smallButton}
                    >
                      Toggle
                    </button>
                    <button 
                      onClick={() => removeMarker(marker.id)}
                      style={{ ...styles.smallButton, marginLeft: '5px' }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Styles
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minHeight: '100vh',
    padding: '20px',
    fontFamily: 'Arial, sans-serif'
  },
  mapWrapper: {
    position: 'relative',
    width: '800px',
    height: '600px',
    border: '8px solid #333',
    overflow: 'hidden',
    marginBottom: '20px'
  },
  mapImage: {
    objectFit: 'contain',
    pointerEvents: 'none'
  },
  marker: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    border: '2px solid white',
    boxShadow: '0 0 5px rgba(0,0,0,0.5)',
    zIndex: 10,
    cursor: 'pointer',
    transition: 'transform 0.2s ease'
  },
  controlPanel: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px'
  },
  button: {
    padding: '8px 16px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    transition: 'background-color 0.3s',
    ':hover': {
      backgroundColor: '#45a049'
    }
  },
  monitoringPanel: {
    width: '800px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  },
  panelTitle: {
    marginTop: '0',
    color: '#333',
    borderBottom: '1px solid #eee',
    paddingBottom: '10px'
  },
  tableContainer: {
    overflowX: 'auto'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  tableRow: {
    borderBottom: '1px solid #eee',
    ':hover': {
      backgroundColor: '#f9f9f9'
    }
  },
  smallButton: {
    padding: '4px 8px',
    fontSize: '12px',
    backgroundColor: '#f0f0f0',
    border: '1px solid #ddd',
    borderRadius: '3px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    ':hover': {
      backgroundColor: '#e0e0e0'
    }
  }
};