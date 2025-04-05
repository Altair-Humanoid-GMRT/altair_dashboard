'use client'
import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import ROSLIB from 'roslib'

export default function RobotMapWithMonitoring() {
  const mapRef = useRef(null)
  const [robotPos, setRobotPos] = useState(null)
  const [ros, setRos] = useState(null)
  const [markers, setMarkers] = useState([])
  const [isConnected, setIsConnected] = useState(false)

  // Initialize ROS connection
  useEffect(() => {
    const ros = new ROSLIB.Ros({ url: 'ws://localhost:9090' })
    
    ros.on('connection', () => {
      console.log('ROS Connected')
      setIsConnected(true)
    })
    
    ros.on('error', (err) => {
      console.error('ROS Error:', err)
      setIsConnected(false)
    })
    
    ros.on('close', () => {
      console.log('ROS Disconnected')
      setIsConnected(false)
    })
    
    setRos(ros)
    return () => ros.close()
  }, [])

  // Subscribe to odometry
  useEffect(() => {
    if (!ros || !isConnected) return

    const odom = new ROSLIB.Topic({
      ros: ros,
      name: '/walk_engine_odometry',
      messageType: 'nav_msgs/Odometry'
    })

    const callback = (msg) => {
      const { position, orientation } = msg.pose.pose
      setRobotPos({
        x: position.x,
        y: position.y,
        theta: Math.atan2(
          2 * (orientation.w * orientation.z + orientation.x * orientation.y),
          1 - 2 * (orientation.y * orientation.y + orientation.z * orientation.z)
        ),
        timestamp: new Date().toLocaleTimeString()
      })
    }

    odom.subscribe(callback)
    return () => odom.unsubscribe()
  }, [ros, isConnected])

  // Add new marker at current robot position
  const addMarker = () => {
    if (!robotPos) return
    
    setMarkers(prev => [...prev, {
      id: Date.now(),
      x: robotPos.x,
      y: robotPos.y,
      timestamp: robotPos.timestamp,
      status: 'active'
    }])
  }

  // Remove marker by ID
  const removeMarker = (id) => {
    setMarkers(prev => prev.filter(m => m.id !== id))
  }

  // Toggle marker status
  const toggleMarker = (id) => {
    setMarkers(prev => prev.map(m => 
      m.id === id 
        ? { ...m, status: m.status === 'active' ? 'inactive' : 'active' } 
        : m
    ))
  }

  return (
    <div style={styles.container}>
      {/* Map Display */}
      <div ref={mapRef} style={styles.mapContainer}>
        <Image
          src="/map.png"
          alt="Map"
          fill
          style={styles.mapImage}
          priority
        />

        {/* Robot Marker */}
        {robotPos && (
          <div style={{
            ...styles.robotMarker,
            transform: `
              translate(
                calc(-50% + ${robotPos.x * 100}px),
                calc(-50% - ${robotPos.y * 100}px)
              )
              rotate(${robotPos.theta}rad)
            `
          }} />
        )}

        {/* Static Markers */}
        {markers.map(marker => (
          <div
            key={marker.id}
            style={{
              ...styles.staticMarker,
              backgroundColor: marker.status === 'active' ? '#4CAF50' : '#f44336',
              transform: `
                translate(
                  calc(-50% + ${marker.x * 100}px),
                  calc(-50% - ${marker.y * 100}px)
                )
              `
            }}
          />
        ))}
      </div>

      {/* Control Panel */}
      <div style={styles.controlPanel}>
        <button 
          onClick={addMarker}
          style={styles.button}
          disabled={!robotPos}
        >
          Add Marker at Current Position
        </button>
        
        <div style={styles.status}>
          ROS: <span style={{ color: isConnected ? 'green' : 'red' }}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
          {robotPos && ` | Robot: (${robotPos.x.toFixed(2)}, ${robotPos.y.toFixed(2)})`}
        </div>
      </div>

      {/* Marker Monitoring Table */}
      <div style={styles.monitoringPanel}>
        <h3 style={styles.panelTitle}>Marker Monitoring</h3>
        
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
              <tr key={marker.id}>
                <td>{marker.id.toString().slice(-4)}</td>
                <td>({marker.x.toFixed(2)}, {marker.y.toFixed(2)})</td>
                <td>
                  <span style={{ 
                    color: marker.status === 'active' ? 'green' : 'red',
                    fontWeight: 'bold'
                  }}>
                    {marker.status.toUpperCase()}
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
                    style={{ ...styles.smallButton, ...styles.dangerButton }}
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
  )
}

// Styles
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px',
    fontFamily: 'Arial, sans-serif'
  },
  mapContainer: {
    position: 'relative',
    width: '800px',
    height: '600px',
    border: '2px solid #333',
    marginBottom: '20px'
  },
  mapImage: {
    objectFit: 'contain',
    pointerEvents: 'none'
  },
  robotMarker: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: '24px',
    height: '24px',
    backgroundColor: 'blue',
    borderRadius: '50%',
    border: '2px solid white',
    zIndex: 20,
    '::after': {
      content: '""',
      position: 'absolute',
      top: '4px',
      left: '50%',
      width: '0',
      height: '0',
      borderLeft: '6px solid transparent',
      borderRight: '6px solid transparent',
      borderBottom: '12px solid white',
      transform: 'translateX(-50%)'
    }
  },
  staticMarker: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    border: '2px solid white',
    zIndex: 15,
    transition: 'all 0.3s ease'
  },
  controlPanel: {
    width: '800px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  button: {
    padding: '10px 15px',
    backgroundColor: '#2196F3',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    ':disabled': {
      backgroundColor: '#cccccc',
      cursor: 'not-allowed'
    }
  },
  status: {
    fontSize: '14px',
    color: '#333'
  },
  monitoringPanel: {
    width: '800px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  panelTitle: {
    marginTop: '0',
    color: '#333',
    borderBottom: '1px solid #eee',
    paddingBottom: '10px'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '10px'
  },
  smallButton: {
    padding: '5px 10px',
    fontSize: '12px',
    backgroundColor: '#f0f0f0',
    border: '1px solid #ddd',
    borderRadius: '3px',
    cursor: 'pointer'
  },
  dangerButton: {
    backgroundColor: '#ffebee',
    borderColor: '#ef9a9a'
  }
}