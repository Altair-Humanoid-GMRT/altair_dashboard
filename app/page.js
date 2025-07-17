'use client';

import React from 'react';
import Link from 'next/link';
import { Gamepad2, Map, Sliders, BookOpen, Eye } from 'lucide-react';
import { useRos } from '../contexts/RosContext';
import ConnectionStatusBar from '../components/ConnectionStatusBar';

export default function Dashboard() {
  const {
    isConnected,
    connectionUri,
    robotNamespace,
    connectionStatus,
    isConnecting,
  } = useRos();

  const dashboardCards = [
    {
      title: 'Tuning Parameters',
      description: 'Configure and adjust robot parameters in real-time',
      icon: <Sliders className="w-8 h-8" />,
      href: '/tuning',
      color: 'bg-blue-500',
      hoverColor: 'hover:bg-blue-600'
    },
    {
      title: 'Head Module',
      description: 'Control head pan/tilt and override mode',
      icon: <Eye className="w-8 h-8" />, // Eye icon for head/vision
      href: '/head_module',
      color: 'bg-yellow-500',
      hoverColor: 'hover:bg-yellow-600'
    },
    {
      title: 'Map Visualization',
      description: 'View robot position and navigation maps',
      icon: <Map className="w-8 h-8" />,
      href: '/map',
      color: 'bg-green-500',
      hoverColor: 'hover:bg-green-600'
    },
    {
      title: 'Gamepad Control',
      description: 'Control robot movement with gamepad interface',
      icon: <Gamepad2 className="w-8 h-8" />,
      href: '/gamepad',
      color: 'bg-purple-500',
      hoverColor: 'hover:bg-purple-600'
    },
    {
      title: 'Documentation',
      description: 'Access Altair robot documentation and guides',
      icon: <BookOpen className="w-8 h-8" />,
      href: 'https://altair-book.readthedocs.io/en/latest/index.html#',
      color: 'bg-orange-500',
      hoverColor: 'hover:bg-orange-600',
      external: true
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Altair Robot Dashboard
          </h1>
          <p className="text-lg text-gray-600">
            Control and monitor your Altair humanoid robot
          </p>
        </div>

        {/* Connection Status Card */}
        <ConnectionStatusBar showFullControls={true} />

        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {dashboardCards.map((card, index) => (
            card.external ? (
              <a key={index} href={card.href} target="_blank" rel="noopener noreferrer">
                <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 cursor-pointer">
                  <div className="p-6">
                    <div className={`${card.color} text-white p-3 rounded-lg inline-block mb-4`}>
                      {card.icon}
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {card.title}
                    </h3>
                    <p className="text-gray-600 mb-4">
                      {card.description}
                    </p>
                    <div className={`${card.color} ${card.hoverColor} text-white px-4 py-2 rounded-md inline-flex items-center transition duration-200`}>
                      Open Documentation
                      <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </div>
                  </div>
                </div>
              </a>
            ) : (
              <Link key={index} href={card.href}>
                <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 cursor-pointer">
                  <div className="p-6">
                    <div className={`${card.color} text-white p-3 rounded-lg inline-block mb-4`}>
                      {card.icon}
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {card.title}
                    </h3>
                    <p className="text-gray-600 mb-4">
                      {card.description}
                    </p>
                    <div className={`${card.color} ${card.hoverColor} text-white px-4 py-2 rounded-md inline-flex items-center transition duration-200`}>
                      Open Module
                      <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            )
          ))}
        </div>

        {/* Quick Stats/Info Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">System Status</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">ROS Connection:</span>
                <span className={`font-medium ${
                  isConnected ? 'text-green-600' : 
                  isConnecting ? 'text-yellow-600' : 
                  connectionStatus === 'Connection Error' ? 'text-red-600' :
                  'text-gray-600'
                }`}>
                  {isConnected ? 'Active' : 
                   isConnecting ? 'Connecting...' : 
                   connectionStatus === 'Connection Error' ? 'Error' :
                   'Inactive'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Connection URI:</span>
                <span className="text-gray-800 text-sm font-mono">
                  {connectionUri || 'Not configured'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Robot Namespace:</span>
                <span className="text-gray-800 text-sm font-mono">
                  {robotNamespace || 'Default'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Dashboard Version:</span>
                <span className="text-gray-800">v0.1.0</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}