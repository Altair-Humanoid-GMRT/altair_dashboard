"use client";

import ROSLIB from "roslib";
// import * as ROS3D from "ros3d";
import React, { useEffect, useState, useCallback } from "react";

export default function Home() {
  const [parameters, setParameters] = useState({});
  const [editingParam, setEditingParam] = useState(null);
  const [cmdParams, setCmdParams] = useState({
    x: 0.0,
    y: 0.0,
    z: 0.0,
  });
  const [newValue, setNewValue] = useState("");

  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 5;
  const RETRY_DELAY = 3500;

  // Create a ref to store the ROS instance
  const rosRef = React.useRef(null);
  const viewerRef = React.useRef(null);

  // Initialize ROS connection
  const initRosConnection = useCallback(() => {
    // Clean up existing connection
    if (rosRef.current) {
      rosRef.current.removeAllListeners();
      rosRef.current.close();
      rosRef.current = null;
    }

    rosRef.current = new ROSLIB.Ros({
      url: "ws://localhost:9090",
    });

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

    // viewerRef.current = new ROS3D.Viewer({
    //   divID: "urdf",
    //   width: 800,
    //   height: 600,
    //   antialias: true,
    // });

    // viewerRef.current.addObject(new ROS3D.Grid());
    // // Setup a client to listen to TFs.
    // const tfClient = new ROSLIB.TFClient({
    //   ros: rosRef.current,
    //   angularThres: 0.01,
    //   transThres: 0.01,
    //   rate: 10.0,
    // });

    // // Setup the URDF client.
    // const urdfClient = new ROS3D.UrdfClient({
    //   ros: rosRef.current,
    //   tfClient: tfClient,
    //   path: "http://resources.robotwebtools.org/",
    //   rootObject: viewerRef.current.scene,
    //   loader: ROS3D.COLLADA_LOADER_2,
    // });
  }, [retryCount]);

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
      name: "/quintic_walk/list_parameters",
      serviceType: "rcl_interfaces/srv/ListParameters",
    });

    const request = new ROSLIB.ServiceRequest({});

    paramClient.callService(request, (response) => {
      const paramNames = response.result.names;
      getParameterValues(paramNames);
    });
  }, [connectionStatus]);

  const fetchROSParameters = useCallback(() => {
    if (!rosRef.current || connectionStatus !== "connected") {
      console.warn("Cannot fetch parameters: ROS connection not established");
      return;
    }

    const paramClient = new ROSLIB.Param({
      ros: rosRef.current,
    });

    paramClient.get(null, (params) => {
      console.log(params);
    });
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
        name: "/quintic_walk/get_parameters",
        serviceType: "rcl_interfaces/srv/GetParameters",
      });

      const request = new ROSLIB.ServiceRequest({
        names: paramNames,
      });

      paramClient.callService(request, (response) => {
        const params = {};
        paramNames.forEach((name, index) => {
          const paramValue = response.values[index];
          params[name] = {
            value: getValueFromParameterValue(paramValue),
            type: paramValue.type,
          };
        });
        setParameters(params);
      });
    },
    [connectionStatus]
  );

  // Function to extract value from ParameterValue
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
      name: "/quintic_walk/set_parameters",
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
        parameter.value.bool_value = value === "true"; // Convert string to boolean
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
        parameter.value.string_array_value = value.split(","); // Convert string to array
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
    paramClient.callService(request, (response) => {
      if (response.results[0].successful) {
        console.log(`Parameter ${paramName} updated successfully.`);
        fetchAllParameters(); // Refresh the parameter list
      } else {
        console.error(response.results[0]);
        console.error(`Failed to update parameter ${paramName}.`);
      }
    });
  };

  const saveParameters = () => {
    const paramClient = new ROSLIB.Service({
      ros: rosRef.current,
      name: "/param_manager/save_parameters",
      serviceType: "std_srvs/srv/Trigger",
    });

    const request = new ROSLIB.ServiceRequest({});
    paramClient.callService(request, (response) => {
      if (response.success) {
        alert("Parameters saved successfully.");
        console.log("Parameters saved successfully.");
      } else {
        console.error("Failed to save parameters.");
      }
    });
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
    console.log(cmdParams);
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

  const handleStopRobot = (x, y, z) => {
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
        x: -1.0,
        y: 0.0,
        z,
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
            {connectionStatus}
          </div>
        </div>
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
                ([paramName, paramData], index) => (
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
                          type="text"
                          value={newValue}
                          onChange={(e) => setNewValue(e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <span className="font-mono">
                          {paramData?.toString() || "undefined"}
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
                          onClick={() => handleEdit(paramName, paramData)}
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
      <div className="flex justify-center space-x-4 mb-8">
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
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
              clipRule="evenodd"
            />
          </svg>
          Play
        </button>

        <button
          onClick={() => handleStopRobot(0.0, 0.0, 0.0)}
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

      {/* Parameters */}
      <div className="mb-8 bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">Parameters</h2>
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
              {Object.entries(parameters).map(
                ([paramName, paramData], index) => (
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
                          type="text"
                          value={newValue}
                          onChange={(e) => setNewValue(e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <span className="font-mono">
                          {paramData.value?.toString() || "undefined"}
                        </span>
                      )}
                    </td>
                    <td className="p-3 border-t border-gray-200">
                      {editingParam === paramName ? (
                        <button
                          onClick={handleSave}
                          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                          disabled={connectionStatus !== "connected"}
                        >
                          Save
                        </button>
                      ) : (
                        <button
                          onClick={() => handleEdit(paramName, paramData.value)}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                          disabled={connectionStatus !== "connected"}
                        >
                          Edit
                        </button>
                      )}
                    </td>
                    <td className="p-3 border-t border-gray-200">
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                        {paramData.type === 1
                          ? "bool"
                          : paramData.type === 2
                          ? "int"
                          : paramData.type === 3
                          ? "double"
                          : paramData.type === 4
                          ? "string"
                          : paramData.type === 9
                          ? "string[]"
                          : "unknown"}
                      </span>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-center mb-6">
        <button
          onClick={saveParameters}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
          disabled={connectionStatus !== "connected"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z" />
          </svg>
          Save Parameters to File
        </button>
      </div>
    </div>
  );
}
