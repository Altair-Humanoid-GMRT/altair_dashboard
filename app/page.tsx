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
    z: 0.3,
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
      url: "ws://10.77.13.101:9090",
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
    console.log(editingParam, newValue);
    console.log(cmdParams[editingParam]);
    setCmdParams[editingParam] = newValue;

    setEditingParam(null);
    setNewValue("");
  };

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-2xl font-bold">Altair Dashboard</h1>
        <div
          className={`text-sm ${
            connectionStatus === "connected"
              ? "text-green-600"
              : connectionStatus === "error"
              ? "text-red-600"
              : "text-yellow-600"
          }`}
        >
          Status: {connectionStatus}
        </div>
      </div>

      <table className="w-full max-w-4xl border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border border-gray-300">Parameter Name</th>
            <th className="p-2 border border-gray-300">Value</th>
            <th className="p-2 border border-gray-300">Actions</th>
            <th className="p-2 border border-gray-300">Type</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(cmdParams).map(([paramName, paramData]) => (
            <tr key={paramName} className="hover:bg-gray-50">
              <td className="p-2 border border-gray-300">{paramName}</td>
              <td className="p-2 border border-gray-300">
                {editingParam === paramName ? (
                  <input
                    type="text"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    className="w-full p-1 border border-gray-300 rounded"
                  />
                ) : (
                  paramData?.toString() || "undefined"
                )}
              </td>
              <td className="p-2 border border-gray-300">
                {editingParam === paramName ? (
                  <button
                    onClick={handleCmdParamsSave}
                    className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                    disabled={connectionStatus !== "connected"}
                  >
                    Save
                  </button>
                ) : (
                  <button
                    onClick={() => handleEdit(paramName, paramData)}
                    className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                    disabled={connectionStatus !== "connected"}
                  >
                    Edit
                  </button>
                )}
              </td>
              <td className="p-2 border border-gray-300">double</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={() => handlePlayRobot(cmdParams.x, cmdParams.y, cmdParams.z)}
        className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600"
      >
        Play
      </button>

      <button
        onClick={() => handleStopRobot(0.0, 0.0, 0.0)}
        className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
      >
        Stop
      </button>

      <table className="w-full max-w-4xl border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border border-gray-300">Parameter Name</th>
            <th className="p-2 border border-gray-300">Value</th>
            <th className="p-2 border border-gray-300">Actions</th>
            <th className="p-2 border border-gray-300">Type</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(parameters).map(([paramName, paramData]) => (
            <tr key={paramName} className="hover:bg-gray-50">
              <td className="p-2 border border-gray-300">{paramName}</td>
              <td className="p-2 border border-gray-300">
                {editingParam === paramName ? (
                  <input
                    type="text"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    className="w-full p-1 border border-gray-300 rounded"
                  />
                ) : (
                  paramData.value?.toString() || "undefined"
                )}
              </td>
              <td className="p-2 border border-gray-300">
                {editingParam === paramName ? (
                  <button
                    onClick={handleSave}
                    className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                    disabled={connectionStatus !== "connected"}
                  >
                    Save
                  </button>
                ) : (
                  <button
                    onClick={() => handleEdit(paramName, paramData.value)}
                    className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                    disabled={connectionStatus !== "connected"}
                  >
                    Edit
                  </button>
                )}
              </td>
              <td className="p-2 border border-gray-300">
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
