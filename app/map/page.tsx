'use client'
import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import ROSLIB from 'roslib'

export default function RobotMapWithHeading() {
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
      const theta = Math.atan2(
        2 * (orientation.w * orientation.z + orientation.x * orientation.y),
        1 - 2 * (orientation.y * orientation.y + orientation.z * orientation.z)
      )
      
      setRobotPos({
        x: position.x,
        y: position.y,
        theta,
        heading: getCardinalDirection(theta),
        timestamp: new Date().toLocaleTimeString()
      })
    }

    odom.subscribe(callback)
    return () => odom.unsubscribe()
  }, [ros, isConnected])

  // Convert radians to cardinal direction
  const getCardinalDirection = (theta) => {
    const degrees = theta * (180/Math.PI)
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    const index = Math.round(((degrees % 360) + 360) % 360 / 45) % 8
    return directions[index]
  }

  // Add new marker
  const addMarker = () => {
    if (!robotPos) return
    
    setMarkers(prev => [...prev, {
      id: Date.now(),
      x: robotPos.x,
      y: robotPos.y,
      heading: robotPos.heading,
      timestamp: robotPos.timestamp,
      status: 'active'
    }])
  }

  // Remove marker
  const removeMarker = (id) => {
    setMarkers(prev => prev.filter(m => m.id !== id))
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

        {/* Robot with Heading Direction */}
        {robotPos && (
          <div style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: `
              translate(
                calc(-50% + ${robotPos.x * 100}px),
                calc(-50% - ${robotPos.y * 100}px)
              )
              rotate(${robotPos.theta}rad)
            `,
            zIndex: 20
          }}>
            <div style={styles.robotBase}></div>
            <div style={styles.robotHeading}></div>
            <div style={styles.headingLabel}>{robotPos.heading}</div>
          </div>
        )}

        {/* Static Markers */}
        {markers.map(marker => (
          <div
            key={marker.id}
            style={{
              ...styles.staticMarker,
              transform: `
                translate(
                  calc(-50% + ${marker.x * 100}px),
                  calc(-50% - ${marker.y * 100}px)
                )
              `
            }}
          >
            <div style={styles.markerHeading}>{marker.heading}</div>
          </div>
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
          {robotPos && ` | Position: (${robotPos.x.toFixed(2)}, ${robotPos.y.toFixed(2)})`}
          {robotPos && ` | Heading: ${robotPos.heading} (${(robotPos.theta * 180/Math.PI).toFixed(1)}°)`}
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
              <th>Heading</th>
              <th>Timestamp</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {markers.map(marker => (
              <tr key={marker.id}>
                <td>{marker.id.toString().slice(-4)}</td>
                <td>({marker.x.toFixed(2)}, {marker.y.toFixed(2)})</td>
                <td>{marker.heading}</td>
                <td>{marker.timestamp}</td>
                <td style={{ color: marker.status === 'active' ? 'green' : 'red' }}>
                  {marker.status.toUpperCase()}
                </td>
                <td>
                  <button 
                    onClick={() => removeMarker(marker.id)}
                    style={styles.smallButton}
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

// Enhanced Styles
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
  robotBase: {
    width: '24px',
    height: '24px',
    backgroundColor: 'blue',
    borderRadius: '50%',
    border: '2px solid white',
    position: 'relative'
  },
  robotHeading: {
    position: 'absolute',
    top: '-15px',
    left: '50%',
    width: '0',
    height: '0',
    borderLeft: '6px solid transparent',
    borderRight: '6px solid transparent',
    borderBottom: '15px solid red',
    transform: 'translateX(-50%)'
  },
  headingLabel: {
    position: 'absolute',
    top: '-35px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(255,255,255,0.8)',
    padding: '2px 5px',
    borderRadius: '3px',
    fontSize: '12px',
    fontWeight: 'bold'
  },
  staticMarker: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: '16px',
    height: '16px',
    backgroundColor: '#4CAF50',
    borderRadius: '50%',
    border: '2px solid white',
    zIndex: 15,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
  },
  markerHeading: {
    position: 'absolute',
    top: '-20px',
    fontSize: '10px',
    fontWeight: 'bold',
    background: 'rgba(255,255,255,0.8)',
    padding: '1px 3px',
    borderRadius: '2px'
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
    marginTop: '10px',
    fontSize: '14px'
  },
  smallButton: {
    padding: '5px 10px',
    fontSize: '12px',
    backgroundColor: '#ffebee',
    border: '1px solid #ef9a9a',
    borderRadius: '3px',
    cursor: 'pointer'
  }
}