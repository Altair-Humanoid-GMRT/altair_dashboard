"use client";

import ROSLIB from "roslib";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { Tooltip } from "react-tooltip";
import "react-tooltip/dist/react-tooltip.css";
import HierarchicalParameters from "@/components/HierarchicalParameters";
import History from "@/components/History";
import ConnectionManager from "@/components/ConnectionManager";

export default function Home() {
  const [parameters, setParameters] = useState({});
  const [editingParam, setEditingParam] = useState(null);
  const [paramDescriptions, setParamDescriptions] = useState({});
  const [selectedParams, setSelectedParams] = useState({});

  const [cmdParams, setCmdParams] = useState({
    x: 0.0,
    y: 0.0,
    z: 0.0,
  });
  const [newValue, setNewValue] = useState("");

  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [connectionUri, setConnectionUri] = useState(() => {
    // Get from localStorage or use default
    return localStorage.getItem("ros_connection_uri") || "ws://localhost:9090";
  });
  const [robotNamespace, setRobotNamespace] = useState(() => {
    return localStorage.getItem("ros_robot_namespace") || "/quintic_walk";
  });
  const [retryCount, setRetryCount] = useState(0);

  const [isLoadingSave, setIsLoadingSave] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const MAX_RETRIES = 5;
  const RETRY_DELAY = 3500;

  // Create a ref to store the ROS instance
  const rosRef = useRef(null);

  // Load selected parameters from localStorage
  useEffect(() => {
    try {
      const storedSelectedParams = localStorage.getItem("selected_parameters");
      if (storedSelectedParams) {
        setSelectedParams(JSON.parse(storedSelectedParams));
      }
    } catch (error) {
      console.error("Error loading selected parameters:", error);
    }
  }, []);

  // Update selectedParams when parameters change (select all by default)
  useEffect(() => {
    if (
      Object.keys(parameters).length > 0 &&
      Object.keys(selectedParams).length === 0
    ) {
      const initialSelection = {};
      Object.keys(parameters).forEach((param) => {
        initialSelection[param] = true;
      });
      setSelectedParams(initialSelection);
      localStorage.setItem(
        "selected_parameters",
        JSON.stringify(initialSelection)
      );
    }
  }, [parameters, selectedParams]);

  // Initialize ROS connection
  const initRosConnection = useCallback(() => {
    // Clean up existing connection
    if (rosRef.current) {
      rosRef.current.removeAllListeners();
      rosRef.current.close();
      rosRef.current = null;
    }

    // Save connection URI to localStorage
    localStorage.setItem("ros_connection_uri", connectionUri);
    localStorage.setItem("ros_robot_namespace", robotNamespace);

    rosRef.current = new ROSLIB.Ros({
      url: connectionUri,
    });
    console.log("Connecting to:", connectionUri);
    console.log("Using namespace:", robotNamespace);

    rosRef.current.on("connection", () => {
      console.log("Connected to websocket server.");
      setConnectionStatus("connected");
      setRetryCount(0);
      fetchAllParameters();
      fetchROSParameters();
    });

    rosRef.current.on("error", (error) => {
      console.error("Error connecting to websocket server: ", error);
      setConnectionStatus("error");

      // Attempt to reconnect if under max retries
      if (retryCount < MAX_RETRIES) {
        setTimeout(() => {
          setRetryCount((prev) => prev + 1);
          initRosConnection();
        }, RETRY_DELAY);
      }
    });

    rosRef.current.on("close", () => {
      console.log("Connection to websocket server closed.");
      setConnectionStatus("disconnected");

      // Attempt to reconnect if under max retries
      if (retryCount < MAX_RETRIES) {
        setTimeout(() => {
          setRetryCount((prev) => prev + 1);
          initRosConnection();
        }, RETRY_DELAY);
      }
    });
  }, [connectionUri, retryCount, robotNamespace]);

  // Initialize connection on component mount
  useEffect(() => {
    initRosConnection();

    // Cleanup on unmount
    return () => {
      if (rosRef.current) {
        rosRef.current.removeAllListeners();
        rosRef.current.close();
        rosRef.current = null;
      }
    };
  }, [initRosConnection]);

  // Function to fetch all parameters
  const fetchAllParameters = useCallback(() => {
    if (!rosRef.current || connectionStatus !== "connected") {
      console.warn("Cannot fetch parameters: ROS connection not established");
      return;
    }

    const paramClient = new ROSLIB.Service({
      ros: rosRef.current,
      name: `${robotNamespace}/list_parameters`,
      serviceType: "rcl_interfaces/srv/ListParameters",
    });

    const request = new ROSLIB.ServiceRequest({});

    paramClient.callService(
      request,
      (response) => {
        const paramNames = response.result.names;
        getParameterValues(paramNames);
        getParameterDescriptions(paramNames);
      },
      (error) => {
        console.error("Error fetching parameters:", error);
        setModalType("error");
        setModalMessage(`Failed to fetch parameters: ${error}`);
        setShowModal(true);
      }
    );
  }, [connectionStatus, robotNamespace]);

  const fetchROSParameters = useCallback(() => {
    if (!rosRef.current || connectionStatus !== "connected") {
      console.warn("Cannot fetch parameters: ROS connection not established");
      return;
    }

    const paramClient = new ROSLIB.Param({
      ros: rosRef.current,
    });

    paramClient.get(
      null,
      (params) => {
        console.log("ROS Parameters:", params);
      },
      (error) => {
        console.error("Error fetching ROS parameters:", error);
      }
    );
  }, [connectionStatus]);

  // Function to handle refresh (rerender)
  const handleRefresh = () => {
    fetchAllParameters();
    fetchROSParameters();
  };

  // Function to get values of specific parameters
  const getParameterValues = useCallback(
    (paramNames) => {
      if (!rosRef.current || connectionStatus !== "connected") {
        return;
      }

      const paramClient = new ROSLIB.Service({
        ros: rosRef.current,
        name: `${robotNamespace}/get_parameters`,
        serviceType: "rcl_interfaces/srv/GetParameters",
      });

      const request = new ROSLIB.ServiceRequest({
        names: paramNames,
      });

      paramClient.callService(
        request,
        (response) => {
          const params = {};
          paramNames.forEach((name, index) => {
            const paramValue = response.values[index];
            params[name] = {
              value: getValueFromParameterValue(paramValue),
              type: paramValue.type,
            };
          });
          setParameters(params);
        },
        (error) => {
          console.error("Error getting parameter values:", error);
        }
      );
    },
    [connectionStatus, robotNamespace]
  );

  const getParameterDescriptions = useCallback(
    (paramNames) => {
      if (!rosRef.current || connectionStatus !== "connected") {
        return;
      }

      const paramClient = new ROSLIB.Service({
        ros: rosRef.current,
        name: `${robotNamespace}/describe_parameters`,
        serviceType: "rcl_interfaces/srv/DescribeParameters",
      });

      const request = new ROSLIB.ServiceRequest({
        names: paramNames,
      });

      paramClient.callService(
        request,
        (response) => {
          const descriptions = {};
          response.descriptors.forEach((descriptor) => {
            descriptions[descriptor.name] = {
              description: descriptor.description,
            };
          });
          setParamDescriptions(descriptions);
        },
        (error) => {
          console.error("Error getting parameter descriptions:", error);
        }
      );
    },
    [connectionStatus, robotNamespace]
  );

  const getValueFromParameterValue = (paramValue) => {
    switch (paramValue.type) {
      case 1: // PARAMETER_BOOL
        return paramValue.bool_value;
      case 2: // PARAMETER_INTEGER
        return paramValue.integer_value;
      case 3: // PARAMETER_DOUBLE
        return paramValue.double_value;
      case 4: // PARAMETER_STRING
        return paramValue.string_value;
      case 9: // PARAMETER_STRING_ARRAY
        return paramValue.string_array_value;
      default:
        return undefined;
    }
  };

  // Function to update a parameter
  const updateParameter = (paramName, value) => {
    const paramClient = new ROSLIB.Service({
      ros: rosRef.current,
      name: `${robotNamespace}/set_parameters`,
      serviceType: "rcl_interfaces/srv/SetParameters",
    });

    // Get the parameter type from the stored parameters
    const paramType = parameters[paramName]?.type;

    if (paramType === undefined) {
      console.error(`Parameter type for ${paramName} not found.`);
      return;
    }

    // Create the Parameter message
    const parameter = new ROSLIB.Message({
      name: paramName,
      value: {
        type: paramType,
      },
    });

    // Set the appropriate value field based on the parameter type
    switch (paramType) {
      case 1: // PARAMETER_BOOL
        parameter.value.bool_value = value === "true" || value === true; // Convert string to boolean
        break;
      case 2: // PARAMETER_INTEGER
        parameter.value.integer_value = parseInt(value, 10);
        break;
      case 3: // PARAMETER_DOUBLE
        parameter.value.double_value = parseFloat(value);
        break;
      case 4: // PARAMETER_STRING
        parameter.value.string_value = value;
        break;
      case 9: // PARAMETER_STRING_ARRAY
        parameter.value.string_array_value = Array.isArray(value)
          ? value
          : value.split(","); // Convert string to array
        break;
      default:
        console.error(`Unsupported parameter type: ${paramType}`);
        return;
    }

    // Create the service request
    const request = new ROSLIB.ServiceRequest({
      parameters: [parameter],
    });

    // Call the service
    paramClient.callService(
      request,
      (response) => {
        if (response.results[0].successful) {
          console.log(`Parameter ${paramName} updated successfully.`);
          fetchAllParameters(); // Refresh the parameter list
        } else {
          console.error(response.results[0]);
          console.error(`Failed to update parameter ${paramName}.`);

          setModalType("error");
          setModalMessage(
            `Failed to update parameter ${paramName}: ${response.results[0].reason}`
          );
          setShowModal(true);
        }
      },
      (error) => {
        console.error(`Service call failed: ${error}`);
        setModalType("error");
        setModalMessage(`Failed to update parameter: ${error}`);
        setShowModal(true);
      }
    );
  };

  const saveParameters = () => {
    if (!rosRef.current || connectionStatus !== "connected") {
      setModalType("error");
      setModalMessage("Cannot save parameters: ROS connection not established");
      setShowModal(true);
      return;
    }

    // Create a list of parameters to save based on selection
    const paramsToSave = Object.keys(selectedParams)
      .filter((param) => selectedParams[param])
      .join(",");

    // If nothing is selected, show warning
    if (!paramsToSave) {
      setModalType("warning");
      setModalMessage("Please select at least one parameter to save");
      setShowModal(true);
      return;
    }

    setIsLoadingSave(true);

    // First publish the parameter list to save
    const paramListTopic = new ROSLIB.Topic({
      ros: rosRef.current,
      name: "/param_manager/params_to_save",
      messageType: "std_msgs/String",
    });

    paramListTopic.publish(new ROSLIB.Message({ data: paramsToSave }));

    // Wait a moment for the topic to be received
    setTimeout(() => {
      const paramClient = new ROSLIB.Service({
        ros: rosRef.current,
        name: "/param_manager/save_parameters",
        serviceType: "std_srvs/srv/Trigger",
      });

      const request = new ROSLIB.ServiceRequest({});
      paramClient.callService(
        request,
        (response) => {
          if (response.success) {
            setIsLoadingSave(false);
            console.log("Parameters saved successfully.");
            setModalType("success");
            setModalMessage("Parameters saved successfully.");
            setShowModal(true);
            handleRefresh();
          } else {
            setIsLoadingSave(false);
            console.error("Failed to save parameters.");
            setModalType("error");
            setModalMessage("Failed to save parameters: " + response.message);
            setShowModal(true);
          }
        },
        (error) => {
          setIsLoadingSave(false);
          console.error(`Service call failed: ${error}`);
          setModalType("error");
          setModalMessage(`Failed to save parameters: ${error}`);
          setShowModal(true);
        }
      );
    }, 300);
  };

  // Function to handle editing a parameter
  const handleEdit = (paramName, currentValue) => {
    setEditingParam(paramName);
    setNewValue(currentValue?.toString() || "");
  };

  // Function to save the edited parameter
  const handleSave = () => {
    if (editingParam && newValue !== "") {
      updateParameter(editingParam, newValue);
      setEditingParam(null);
      setNewValue("");
    }
  };

  const handlePlayRobot = (x, y, z) => {
    if (!rosRef.current || connectionStatus !== "connected") {
      setModalType("error");
      setModalMessage("Cannot control robot: ROS connection not established");
      setShowModal(true);
      return;
    }

    console.log("Sending cmd_vel", { x, y, z });
    const cmdVel = new ROSLIB.Topic({
      ros: rosRef.current,
      name: "/cmd_vel",
      messageType: "geometry_msgs/Twist",
    });

    const twist = new ROSLIB.Message({
      linear: {
        x,
        y,
        z: 0.0,
      },
      angular: {
        x: 0.0,
        y: 0.0,
        z,
      },
    });

    cmdVel.publish(twist);
  };

  const handleStopRobot = () => {
    if (!rosRef.current || connectionStatus !== "connected") {
      setModalType("error");
      setModalMessage("Cannot control robot: ROS connection not established");
      setShowModal(true);
      return;
    }

    const cmdVel = new ROSLIB.Topic({
      ros: rosRef.current,
      name: "/cmd_vel",
      messageType: "geometry_msgs/Twist",
    });

    const twist = new ROSLIB.Message({
      linear: {
        x: 0.0,
        y: 0.0,
        z: 0.0,
      },
      angular: {
        x: -1.0,
        y: 0.0,
        z: 0.0,
      },
    });

    cmdVel.publish(twist);
  };

  const handleCmdParamsSave = () => {
    if (editingParam !== null) {
      setCmdParams((prevCmdParams) => ({
        ...prevCmdParams,
        [editingParam]: parseFloat(newValue),
      }));

      setEditingParam(null);
      setNewValue("");
    }
  };

  const handleParamSelectionChange = (paramName, isSelected) => {
    setSelectedParams((prev) => {
      const updated = { ...prev, [paramName]: isSelected };
      localStorage.setItem("selected_parameters", JSON.stringify(updated));
      return updated;
    });
  };

  const handleSelectAllParams = (isSelected) => {
    const updated = {};
    Object.keys(parameters).forEach((param) => {
      updated[param] = isSelected;
    });
    setSelectedParams(updated);
    localStorage.setItem("selected_parameters", JSON.stringify(updated));
  };

  const applySettings = (newConnectionUri, newRobotNamespace) => {
    // Only reconnect if settings actually changed
    if (
      newConnectionUri !== connectionUri ||
      newRobotNamespace !== robotNamespace
    ) {
      setConnectionUri(newConnectionUri);
      setRobotNamespace(newRobotNamespace);
      // Connection will be reinitialized by useEffect
    }
    setShowSettingsModal(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <header className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold text-gray-800">Altair Dashboard</h1>
          <div
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              connectionStatus === "connected"
                ? "bg-green-100 text-green-800"
                : connectionStatus === "error"
                ? "bg-red-100 text-red-800"
                : "bg-yellow-100 text-yellow-800"
            }`}
          >
            {connectionStatus === "connected"
              ? "Connected"
              : connectionStatus === "error"
              ? "Connection Error"
              : "Disconnected"}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                  clipRule="evenodd"
                />
              </svg>
              Settings
            </div>
          </button>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={connectionStatus !== "connected"}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                clipRule="evenodd"
              />
            </svg>
            Refresh
          </button>
        </div>
      </header>

      {/* Command Parameters */}
      <div className="mb-8 bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">
          Command Parameters
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-left p-3 text-gray-600 font-semibold">
                  Parameter Name
                </th>
                <th className="text-left p-3 text-gray-600 font-semibold">
                  Value
                </th>
                <th className="text-left p-3 text-gray-600 font-semibold">
                  Actions
                </th>
                <th className="text-left p-3 text-gray-600 font-semibold">
                  Type
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(cmdParams).map(
                ([paramName, paramValue], index) => (
                  <tr
                    key={paramName}
                    className={`${
                      index % 2 === 0 ? "bg-gray-50" : "bg-white"
                    } hover:bg-blue-50`}
                  >
                    <td className="p-3 border-t border-gray-200">
                      {paramName}
                    </td>
                    <td className="p-3 border-t border-gray-200">
                      {editingParam === paramName ? (
                        <input
                          type="number"
                          step="0.1"
                          value={newValue}
                          onChange={(e) => setNewValue(e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <span className="font-mono">
                          {paramValue?.toString() || "0.0"}
                        </span>
                      )}
                    </td>
                    <td className="p-3 border-t border-gray-200">
                      {editingParam === paramName ? (
                        <button
                          onClick={handleCmdParamsSave}
                          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                          disabled={connectionStatus !== "connected"}
                        >
                          Save
                        </button>
                      ) : (
                        <button
                          onClick={() => handleEdit(paramName, paramValue)}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                          disabled={connectionStatus !== "connected"}
                        >
                          Edit
                        </button>
                      )}
                    </td>
                    <td className="p-3 border-t border-gray-200">
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                        double
                      </span>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Robot Controls */}
      <div className="flex flex-wrap gap-4 justify-center mb-8">
        <button
          onClick={() => handlePlayRobot(cmdParams.x, cmdParams.y, cmdParams.z)}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
          disabled={connectionStatus !== "connected"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-4-4a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-2.293 2.293a1 1 0 101.414 1.414l4-4a1 1 0 000-1.414z"
              clipRule="evenodd"
            />
          </svg>
          Play
        </button>
        <button
          onClick={() => handlePlayRobot(cmdParams.x, 0, 0)}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
          disabled={connectionStatus !== "connected"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z"
              clipRule="evenodd"
            />
          </svg>
          Forward
        </button>

        <button
          onClick={() => handlePlayRobot(0, cmdParams.y, 0)}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
          disabled={connectionStatus !== "connected"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm-3.707-8.707a1 1 0 01-1.414-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L10 8.414l-1.293 1.293a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
          Lateral
        </button>

        <button
          onClick={() => handlePlayRobot(0, 0, cmdParams.z)}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
          disabled={connectionStatus !== "connected"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1.293-7.293a1 1 0 011.414 0L11 11.586V8a1 1 0 012 0v3.586l.88-.88a1 1 0 111.414 1.415l-2.121 2.121a1 1 0 01-1.414 0l-2.122-2.121a1 1 0 010-1.415z"
              clipRule="evenodd"
            />
          </svg>
          Rotate
        </button>

        <button
          onClick={handleStopRobot}
          className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 font-medium"
          disabled={connectionStatus !== "connected"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z"
              clipRule="evenodd"
            />
          </svg>
          Stop
        </button>
      </div>

      {/* Add the History Section */}
      <History
        rosRef={rosRef}
        connectionStatus={connectionStatus}
        robotNamespace={robotNamespace}
        onRestore={() => {
          // Function to call after a parameter file is restored
          setModalType("success");
          setModalMessage("Parameters restored successfully");
          setShowModal(true);
          handleRefresh();
        }}
        onRefresh={handleRefresh}
      />

      {/* Parameters */}
      <HierarchicalParameters
        parameters={parameters}
        descriptions={paramDescriptions}
        connectionStatus={connectionStatus}
        handleEdit={handleEdit}
        handleSave={handleSave}
        setNewValue={setNewValue}
        newValue={newValue}
        editingParam={editingParam}
        selectedParams={selectedParams}
        onSelectionChange={handleParamSelectionChange}
        onSelectAll={handleSelectAllParams}
      />

      {/* Save Button */}
      <div className="flex justify-center mb-6">
        <button
          onClick={saveParameters}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
          disabled={connectionStatus !== "connected" || isLoadingSave}
        >
          {isLoadingSave ? (
            <>
              <svg
                className="animate-spin h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Saving...
            </>
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z" />
              </svg>
              Save Selected Parameters to File
            </>
          )}
        </button>
      </div>

      {/* Modal for saving parameters status */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3
                className={`text-lg font-medium ${
                  modalType === "success"
                    ? "text-green-700"
                    : modalType === "warning"
                    ? "text-yellow-700"
                    : "text-red-700"
                }`}
              >
                {modalType === "success"
                  ? "Success"
                  : modalType === "warning"
                  ? "Warning"
                  : "Error"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="mb-6">
              <p className="text-gray-700">{modalMessage}</p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className={`px-4 py-2 rounded-md text-white ${
                  modalType === "success"
                    ? "bg-green-600 hover:bg-green-700"
                    : modalType === "warning"
                    ? "bg-yellow-600 hover:bg-yellow-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <ConnectionManager
          currentUri={connectionUri}
          currentNamespace={robotNamespace}
          onApply={applySettings}
          onCancel={() => setShowSettingsModal(false)}
        />
      )}

      <Tooltip
        id="param-tooltip"
        place="right"
        effect="solid"
        className="z-[1000] max-w-xs bg-gray-800 text-white p-2 text-sm rounded shadow-lg"
      />
    </div>
  );
}
