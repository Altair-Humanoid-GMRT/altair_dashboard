'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import ROSLIB from 'roslib';

const RosContext = createContext();

export const useRos = () => {
  const context = useContext(RosContext);
  if (!context) {
    throw new Error('useRos must be used within a RosProvider');
  }
  return context;
};

export const RosProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionUri, setConnectionUri] = useState('ws://localhost:9090');
  const [robotNamespace, setRobotNamespace] = useState('');
  const [walkPackage, setWalkPackage] = useState('quintic_walk');
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  // Create a ref to store the ROS instance
  const rosRef = useRef(null);
  
  // Track if this is the initial load to avoid unnecessary reconnections
  const initialLoadRef = useRef(true);
  
  // Track if connection was manually cancelled to prevent auto-reconnect
  const connectionCancelledRef = useRef(false);
  
  // Store health check interval ref to clear it when needed
  const healthCheckIntervalRef = useRef(null);

  // Validate WebSocket URL
  const validateWebSocketUrl = useCallback((url) => {
    try {
      // Check if URL starts with ws:// or wss://
      if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
        return { valid: false, error: 'URL must start with ws:// or wss://' };
      }
      
      // Try to create a URL object to validate format
      const urlObj = new URL(url);
      
      // Check if port is valid (1-65535)
      if (urlObj.port && (parseInt(urlObj.port) < 1 || parseInt(urlObj.port) > 65535)) {
        return { valid: false, error: 'Port number must be between 1 and 65535' };
      }
      
      return { valid: true };
    } catch (error) {
      return { valid: false, error: 'Invalid URL format' };
    }
  }, []);

  // Load saved connection settings on context mount
  useEffect(() => {
    try {
      const savedUri = localStorage.getItem('ros_connection_uri');
      const savedNamespace = localStorage.getItem('ros_robot_namespace');
      const savedWalkPackage = localStorage.getItem('ros_walk_package');
      
      if (savedUri) {
        // Validate saved URI before setting it
        const validation = validateWebSocketUrl(savedUri);
        if (validation.valid) {
          setConnectionUri(savedUri);
        } else {
          console.warn('Invalid saved URI found, removing from localStorage:', validation.error);
          localStorage.removeItem('ros_connection_uri');
          setConnectionStatus(`Saved URL invalid: ${validation.error}`);
        }
      }
      
      if (savedNamespace) {
        setRobotNamespace(savedNamespace);
      }
      
      if (savedWalkPackage) {
        setWalkPackage(savedWalkPackage);
      }
      
      // Auto-connect on initial load if we have valid saved settings
      if (initialLoadRef.current && savedUri) {
        const validation = validateWebSocketUrl(savedUri);
        if (validation.valid) {
          initialLoadRef.current = false;
          setTimeout(() => {
            initRosConnection(false); // Don't force reconnect on initial load
          }, 500);
        }
      }
    } catch (error) {
      console.error('Error loading connection settings:', error);
    }
  }, []); // Empty dependency array to run only once on mount

  // Initialize ROS connection
  const initRosConnection = useCallback((forceReconnect = false) => {
    // Don't connect if connection was manually cancelled
    if (connectionCancelledRef.current && !forceReconnect) {
      console.log('Connection was cancelled, skipping reconnection');
      return;
    }

    // Only clean up existing connection if we're forcing a reconnect or if there's no active connection
    if (rosRef.current && (forceReconnect || !isConnected)) {
      rosRef.current.removeAllListeners();
      rosRef.current.close();
      rosRef.current = null;
    }

    // If already connected and not forcing reconnect, don't create a new connection
    if (rosRef.current && isConnected && !forceReconnect) {
      console.log('Already connected to ROS, skipping reconnection');
      return;
    }

    if (!connectionUri) {
      console.warn('Cannot connect: No connection URI provided');
      setConnectionStatus('No URI configured');
      setIsConnecting(false);
      return;
    }

    // Validate the WebSocket URL before attempting connection
    const validation = validateWebSocketUrl(connectionUri);
    if (!validation.valid) {
      console.error('Invalid WebSocket URL:', validation.error);
      setConnectionStatus(`Invalid URL: ${validation.error}`);
      setIsConnecting(false);
      setIsConnected(false);
      return;
    }

    // Clear cancelled flag when attempting connection
    connectionCancelledRef.current = false;
    
    setIsConnecting(true);
    setConnectionStatus('Connecting...');

    try {
      rosRef.current = new ROSLIB.Ros({
        url: connectionUri,
      });

      console.log('Connecting to:', connectionUri);
      console.log('Using namespace:', robotNamespace);

      rosRef.current.on('connection', () => {
        console.log('Connected to websocket server.');
        setIsConnected(true);
        setConnectionStatus('Connected');
        setIsConnecting(false);
        setLastError(null); // Clear any previous errors
        setReconnectAttempts(0); // Reset reconnect attempts
      });

      rosRef.current.on('error', (error) => {
        console.error('Error connecting to websocket server: ', error);
        
        // Enhanced error parsing for better user feedback
        let errorMessage = 'Unknown connection error';
        let errorType = 'Connection Error';
        
        if (error) {
          if (typeof error === 'string') {
            errorMessage = error;
          } else if (error.message) {
            errorMessage = error.message;
          } else if (error.code) {
            switch (error.code) {
              case 'ECONNREFUSED':
                errorMessage = 'Connection refused - is the ROS bridge running?';
                errorType = 'Connection Refused';
                break;
              case 'ENOTFOUND':
                errorMessage = 'Host not found - check the connection URI';
                errorType = 'Host Not Found';
                break;
              case 'ETIMEDOUT':
                errorMessage = 'Connection timeout - check network connectivity';
                errorType = 'Connection Timeout';
                break;
              default:
                errorMessage = `${error.code}: ${error.message || 'Network error'}`;
                errorType = 'Network Error';
            }
          } else if (typeof error === 'object') {
            // For WebSocket errors, try to extract meaningful info
            if (error.type === 'error') {
              errorMessage = 'WebSocket connection failed - check if ROS bridge is running';
              errorType = 'WebSocket Error';
            } else {
              errorMessage = JSON.stringify(error, null, 2);
            }
          }
        }
        
        // Check if this looks like a port issue
        if (connectionUri.includes(':99000') || connectionUri.includes(':999')) {
          errorMessage = 'Invalid port number detected. Standard ROS bridge port is 9090.';
          errorType = 'Invalid Port';
        }
        
        const fullErrorMessage = `${errorType}: ${errorMessage}`;
        setLastError(fullErrorMessage);
        setIsConnected(false);
        setIsConnecting(false);
        setConnectionStatus(fullErrorMessage);
        setReconnectAttempts(prev => prev + 1);
        
        // Stop auto-reconnection after 3 failed attempts
        if (reconnectAttempts >= 2) {
          console.warn('Max reconnection attempts reached, stopping auto-reconnect');
          connectionCancelledRef.current = true;
          setConnectionStatus(`${fullErrorMessage}. Max attempts reached - click Connect to retry.`);
        }
      });

      rosRef.current.on('close', () => {
        console.log('Connection to websocket server closed.');
        setIsConnected(false);
        setIsConnecting(false);
        setConnectionStatus('Disconnected');
      });
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      const errorMessage = error?.message || error?.toString() || 'Unknown WebSocket error';
      setLastError(`WebSocket creation failed: ${errorMessage}`);
      setIsConnected(false);
      setIsConnecting(false);
      setConnectionStatus(`WebSocket Error: ${errorMessage}`);
      rosRef.current = null;
      setReconnectAttempts(prev => prev + 1);
    }
  }, [connectionUri, robotNamespace, isConnected]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear health check interval
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
        healthCheckIntervalRef.current = null;
      }
      
      if (rosRef.current) {
        rosRef.current.removeAllListeners();
        rosRef.current.close();
        rosRef.current = null;
      }
    };
  }, []);

  // Connection health check - periodically verify connection is still active
  useEffect(() => {
    // Clear any existing interval
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
      healthCheckIntervalRef.current = null;
    }

    if (!isConnected || !rosRef.current || connectionCancelledRef.current) return;

    healthCheckIntervalRef.current = setInterval(() => {
      // Don't attempt reconnect if connection was cancelled or max attempts reached
      if (connectionCancelledRef.current || reconnectAttempts >= 3) {
        clearInterval(healthCheckIntervalRef.current);
        healthCheckIntervalRef.current = null;
        return;
      }

      // Check if the websocket is still open
      if (rosRef.current && rosRef.current.socket) {
        if (rosRef.current.socket.readyState === WebSocket.CLOSED || 
            rosRef.current.socket.readyState === WebSocket.CLOSING) {
          console.log('Connection lost, attempting to reconnect...');
          setIsConnected(false);
          setConnectionStatus('Reconnecting...');
          // Attempt to reconnect
          setTimeout(() => {
            if (!connectionCancelledRef.current && reconnectAttempts < 3) {
              initRosConnection(true);
            }
          }, 1000);
        }
      }
    }, 5000); // Check every 5 seconds

    return () => {
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
        healthCheckIntervalRef.current = null;
      }
    };
  }, [isConnected, initRosConnection]);

  const connect = () => {
    connectionCancelledRef.current = false; // Clear cancelled flag
    setReconnectAttempts(0); // Reset reconnect attempts
    setLastError(null); // Clear previous errors
    initRosConnection(true); // Force reconnect
  };

  const disconnect = () => {
    // Set cancelled flag to prevent auto-reconnect
    connectionCancelledRef.current = true;
    
    // Clear health check interval
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
      healthCheckIntervalRef.current = null;
    }
    
    if (rosRef.current) {
      rosRef.current.removeAllListeners();
      rosRef.current.close();
      rosRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
    setConnectionStatus('Disconnected');
    setLastError(null); // Clear errors when manually disconnecting
    setReconnectAttempts(0); // Reset reconnect attempts
  };

  const updateConnection = (uri, namespace, walkPkg) => {
    // Validate the URI before updating
    const validation = validateWebSocketUrl(uri);
    if (!validation.valid) {
      console.error('Invalid WebSocket URL provided:', validation.error);
      setConnectionStatus(`Invalid URL: ${validation.error}`);
      return;
    }

    const uriChanged = uri !== connectionUri;
    const namespaceChanged = namespace !== robotNamespace;
    const walkPackageChanged = walkPkg !== walkPackage;
    
    setConnectionUri(uri);
    setRobotNamespace(namespace);
    if (walkPkg !== undefined) {
      setWalkPackage(walkPkg);
    }
    
    // Save to localStorage only if URI is valid
    try {
      localStorage.setItem('ros_connection_uri', uri);
      localStorage.setItem('ros_robot_namespace', namespace);
      if (walkPkg !== undefined) {
        localStorage.setItem('ros_walk_package', walkPkg);
      }
    } catch (error) {
      console.error('Error saving connection settings:', error);
    }
    
    // Only reconnect if URI actually changed (namespace change doesn't require reconnection)
    if (uriChanged) {
      connectionCancelledRef.current = false; // Clear cancelled flag when updating connection
      setTimeout(() => {
        initRosConnection(true); // Force reconnect only if URI changed
      }, 100);
    }
  };

  const cancelConnection = () => {
    // Set cancelled flag to prevent any further connection attempts
    connectionCancelledRef.current = true;
    
    // Clear health check interval
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
      healthCheckIntervalRef.current = null;
    }
    
    // Update state
    setIsConnecting(false);
    setConnectionStatus('Disconnected');
    
    if (rosRef.current) {
      rosRef.current.removeAllListeners();
      rosRef.current.close();
      rosRef.current = null;
    }
    
    // Also update connected state
    setIsConnected(false);
  };

  // Function to get the ROS instance for use in components
  const getRos = () => rosRef.current;

  // Function to check if connection is healthy
  const isConnectionHealthy = () => {
    if (!rosRef.current || !isConnected) return false;
    if (!rosRef.current.socket) return false;
    return rosRef.current.socket.readyState === WebSocket.OPEN;
  };

  // Function to ensure connection is maintained
  const ensureConnection = () => {
    if (!connectionCancelledRef.current && !isConnectionHealthy() && connectionUri) {
      console.log('Ensuring connection is maintained...');
      initRosConnection(false);
    }
  };

  const value = {
    // Connection state
    isConnected,
    connectionUri,
    robotNamespace,
    walkPackage,
    connectionStatus,
    isConnecting,
    lastError,
    reconnectAttempts,
    
    // Connection actions
    connect,
    disconnect,
    updateConnection,
    cancelConnection,
    setWalkPackage,
    
    // ROS instance
    getRos,
    
    // Connection utilities
    isConnectionHealthy,
    ensureConnection,
  };

  return (
    <RosContext.Provider value={value}>
      {children}
    </RosContext.Provider>
  );
};
