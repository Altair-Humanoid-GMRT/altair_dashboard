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
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [isConnecting, setIsConnecting] = useState(false);

  // Create a ref to store the ROS instance
  const rosRef = useRef(null);

  // Load saved connection settings on context mount
  useEffect(() => {
    try {
      const savedUri = localStorage.getItem('ros_connection_uri');
      const savedNamespace = localStorage.getItem('ros_robot_namespace');
      
      if (savedUri) {
        setConnectionUri(savedUri);
      }
      if (savedNamespace) {
        setRobotNamespace(savedNamespace);
      }
    } catch (error) {
      console.error('Error loading connection settings:', error);
    }
  }, []); // Empty dependency array to run only once on mount

  // Initialize ROS connection
  const initRosConnection = useCallback(() => {
    // Clean up existing connection
    if (rosRef.current) {
      rosRef.current.removeAllListeners();
      rosRef.current.close();
      rosRef.current = null;
    }

    if (!connectionUri) {
      console.warn('Cannot connect: No connection URI provided');
      setConnectionStatus('No URI configured');
      return;
    }

    setIsConnecting(true);
    setConnectionStatus('Connecting...');

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
    });

    rosRef.current.on('error', (error) => {
      console.error('Error connecting to websocket server: ', error);
      setIsConnected(false);
      setIsConnecting(false);
      setConnectionStatus('Connection Error');
    });

    rosRef.current.on('close', () => {
      console.log('Connection to websocket server closed.');
      setIsConnected(false);
      setIsConnecting(false);
      setConnectionStatus('Disconnected');
    });
  }, [connectionUri, robotNamespace]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rosRef.current) {
        rosRef.current.removeAllListeners();
        rosRef.current.close();
        rosRef.current = null;
      }
    };
  }, []);

  const connect = () => {
    initRosConnection();
  };

  const disconnect = () => {
    if (rosRef.current) {
      rosRef.current.removeAllListeners();
      rosRef.current.close();
      rosRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
    setConnectionStatus('Disconnected');
  };

  const updateConnection = (uri, namespace) => {
    setConnectionUri(uri);
    setRobotNamespace(namespace);
    
    // Save to localStorage
    try {
      localStorage.setItem('ros_connection_uri', uri);
      localStorage.setItem('ros_robot_namespace', namespace);
    } catch (error) {
      console.error('Error saving connection settings:', error);
    }
    
    // Attempt to connect with new settings
    setTimeout(() => {
      initRosConnection();
    }, 100);
  };

  const cancelConnection = () => {
    setIsConnecting(false);
    setConnectionStatus('Disconnected');
    if (rosRef.current) {
      rosRef.current.removeAllListeners();
      rosRef.current.close();
      rosRef.current = null;
    }
  };

  // Function to get the ROS instance for use in components
  const getRos = () => rosRef.current;

  const value = {
    // Connection state
    isConnected,
    connectionUri,
    robotNamespace,
    connectionStatus,
    isConnecting,
    
    // Connection actions
    connect,
    disconnect,
    updateConnection,
    cancelConnection,
    
    // ROS instance
    getRos,
  };

  return (
    <RosContext.Provider value={value}>
      {children}
    </RosContext.Provider>
  );
};
