"use client";

import ROSLIB from "roslib";
import React, { useEffect, useState, useCallback } from "react";

export default function Home() {
  const [parameters, setParameters] = useState({});
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [retryCount, setRetryCount] = useState(0);
  const [activeTab, setActiveTab] = useState("");
  const [ip, setIp] = useState("192.168.43.41"); // Default IP
  const [port, setPort] = useState("9090"); // Default port
  const [isEditingConnection, setIsEditingConnection] = useState(false); // Toggle connection input form
  const [editedValues, setEditedValues] = useState({}); // Store edited values
  const MAX_RETRIES = 5;
  const RETRY_DELAY = 3500;

  // Create a ref to store the ROS instance
  const rosRef = React.useRef(null);

  // Initialize ROS connection
  const initRosConnection = useCallback(
    (newIp, newPort) => {
      // Clean up existing connection
      if (rosRef.current) {
        rosRef.current.removeAllListeners();
        rosRef.current.close();
        rosRef.current = null;
      }

      const url = `ws://${newIp || ip}:${newPort || port}`;
      rosRef.current = new ROSLIB.Ros({ url });

      rosRef.current.on("connection", () => {
        console.log("Connected to websocket server.");
        setConnectionStatus("connected");
        setRetryCount(0);
        fetchAllParameters();
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
    },
    [ip, port, retryCount]
  );

  // Initialize connection on component mount
  useEffect(() => {
    initRosConnection();
  }, [initRosConnection]);

  // Function to handle saving new connection details
  const handleSaveConnection = () => {
    setIsEditingConnection(false); // Hide the input form
    initRosConnection(ip, port); // Reinitialize the connection with the new IP and port
  };

  // Function to fetch all parameters
  // const fetchAllParameters = useCallback(() => {
  //   if (!rosRef.current || connectionStatus !== "connected") {
  //     console.warn("Cannot fetch parameters: ROS connection not established");
  //     return;
  //   }

  //   const paramClient = new ROSLIB.Service({
  //     ros: rosRef.current,
  //     name: "/param_manager/list_parameters",
  //     serviceType: "rcl_interfaces/srv/ListParameters",
  //   });

  //   const request = new ROSLIB.ServiceRequest({});

  //   paramClient.callService(request, (response) => {
  //     const paramNames = response.result.names;
  //     getParameterValues(paramNames);
  //   });
  // }, [connectionStatus]);

  const fetchAllParameters = useCallback(() => {
    if (!rosRef.current || connectionStatus !== "connected") return;

    const paramClient = new ROSLIB.Service({
      ros: rosRef.current,
      name: "/param_manager/get_parameters_json",
      serviceType: "std_srvs/srv/Trigger",
    });

    paramClient.callService(new ROSLIB.ServiceRequest({}), (response) => {
      try {
        const params = JSON.parse(response.message);
        const typedParams = inferParameterTypes(params);
        setParameters(typedParams);
        setActiveTab(Object.keys(params)[0]);
      } catch (error) {
        console.error("Error parsing parameters:", error);
      }
    });
  }, [connectionStatus]);

  // Function to infer parameter types
  const inferParameterTypes = (params) => {
    const typedParams = {};

    Object.entries(params).forEach(([name, value]) => {
      if (typeof value === "object" && !Array.isArray(value)) {
        typedParams[name] = {
          type: 0,
          ros__parameters: inferParameterTypes(value),
        };
      } else {
        typedParams[name] = {
          type: inferType(value),
          value,
        };
      }
    });

    return typedParams;
  };

  const inferType = (value) => {
    if (typeof value === "boolean") return 1; // PARAMETER_BOOL
    if (typeof value === "number" && Number.isInteger(value)) return 2; // PARAMETER_INTEGER
    if (typeof value === "number") return 3; // PARAMETER_DOUBLE
    if (typeof value === "string") return 4; // PARAMETER_STRING
    if (Array.isArray(value) && value.every((item) => typeof item === "string"))
      return 9; // PARAMETER_STRING_ARRAY
    return 0; // Unknown type
  };

  // New function to render parameter tree
  const renderParameterTree = (params, path = []) => {
    return Object.entries(params).map(([key, value]) => {
      const currentPath = [...path, key];
      const isNested = typeof value === "object" && !("type" in value);
      const fullName = currentPath.join(".");

      return (
        <div key={fullName} className="ml-4">
          <div className="flex items-center gap-2 hover:bg-gray-50 p-1 rounded">
            {isNested ? (
              <details>
                <summary className="cursor-pointer font-medium text-blue-600">
                  {key}
                </summary>
                <div className="ml-4">
                  {renderParameterTree(value, currentPath)}
                </div>
              </details>
            ) : (
              <div className="flex items-center gap-4 w-full">
                <span className="w-60 font-mono text-sm">{key}</span>
                <span className="w-12 text-gray-500 text-sm">({value})</span>
                <input
                  type="text"
                  value={
                    editedValues[fullName] ?? (value.value?.toString() || "")
                  }
                  onChange={(e) => handleInlineEdit(fullName, e.target.value)}
                  className="flex-1 p-1 border border-gray-300 rounded text-sm"
                />
              </div>
            )}
          </div>
        </div>
      );
    });
  };

  // Function to get values of specific parameters
  const getParameterValues = useCallback(
    (paramNames) => {
      if (!rosRef.current || connectionStatus !== "connected") {
        return;
      }

      const paramClient = new ROSLIB.Service({
        ros: rosRef.current,
        name: "/param_manager/get_parameters",
        serviceType: "rcl_interfaces/srv/GetParameters",
      });

      const request = new ROSLIB.ServiceRequest({
        names: paramNames,
      });

      paramClient.callService(request, (response) => {
        const params = {};
        paramNames.forEach((name, index) => {
          params[name] = response.values[index];
        });
        setParameters(params);
        groupParameters(params);
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

  // Function to group parameters by their nested names
  const groupParameters = (params) => {
    const groupedParams = {};

    Object.keys(params).forEach((paramName) => {
      const parts = paramName.split(".");
      let currentLevel = groupedParams;

      parts.forEach((part, index) => {
        if (!currentLevel[part]) {
          currentLevel[part] = {};
        }
        if (index === parts.length - 1) {
          currentLevel[part] = params[paramName];
        } else {
          currentLevel = currentLevel[part];
        }
      });
    });

    setGroupedParameters(groupedParams);
    setActiveTab(Object.keys(groupedParams)[0]);
  };

  const [groupedParameters, setGroupedParameters] = useState({});

  // Function to update a parameter
  const updateParameter = (paramName, value) => {
    const paramClient = new ROSLIB.Service({
      ros: rosRef.current,
      name: "/param_manager/set_parameters",
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

  // Function to handle inline editing
  const handleInlineEdit = (paramName, value) => {
    setEditedValues((prev) => ({
      ...prev,
      [paramName]: value,
    }));
  };

  // Function to save all edited values in the active tab
  const saveActiveTabParameters = () => {
    Object.keys(editedValues).forEach((paramName) => {
      updateParameter(paramName, editedValues[paramName]);
    });
    setEditedValues({}); // Clear edited values after saving
  };

  // Function to render nested parameters
  const renderNestedParameters = (params, prefix = "") => {
    return Object.keys(params).map((key) => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      const paramData = params[key];

      if (typeof paramData === "object") {
        return (
          <div key={fullKey} className="pl-4">
            <h3 className="font-bold">{key}</h3>
            {renderNestedParameters(paramData, fullKey)}
          </div>
        );
      } else {
        return (
          <div key={fullKey} className="flex items-center gap-4 mb-2">
            <label className="w-48">{key}</label>
            <input
              type="text"
              value={
                editedValues[fullKey] ?? (paramData.value?.toString() || "")
              }
              onChange={(e) => handleInlineEdit(fullKey, e.target.value)}
              className="w-full p-1 border border-gray-300 rounded"
              placeholder={paramData.value?.toString() || ""}
            />
          </div>
        );
      }
    });
  };

  // Function to get the type name
  const getTypeName = (type) => {
    switch (type) {
      case 1:
        return "bool";
      case 2:
        return "int";
      case 3:
        return "double";
      case 4:
        return "string";
      case 9:
        return "string[]";
      default:
        return "unknown";
    }
  };
  console.log(parameters);

  return (
    <div className="min-h-screen p-8 bg-gray-100">
      <div className="max-w-6xl mx-auto">
        {/* Connection Status Bar */}
        <div className="mb-8 p-4 bg-white rounded-lg shadow">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Altair Dashboard</h1>
            <div className="flex items-center gap-4">
              <div
                className={`badge ${
                  connectionStatus === "connected"
                    ? "badge-success"
                    : "badge-error"
                }`}
              >
                {connectionStatus}
              </div>
              <button
                onClick={fetchAllParameters}
                className="btn btn-sm btn-primary"
                disabled={connectionStatus !== "connected"}
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex gap-8">
          {/* Parameter Groups Sidebar */}
          <div className="w-64 bg-white rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold mb-4">Parameter Groups</h2>
            <div className="space-y-2">
              {Object.keys(parameters).map((group) => (
                <button
                  key={group}
                  onClick={() => setActiveTab(group)}
                  className={`btn btn-block btn-sm justify-start ${
                    activeTab === group ? "btn-active" : ""
                  }`}
                >
                  {group}
                </button>
              ))}
            </div>
          </div>

          {/* Parameter Details */}
          <div className="flex-1 bg-white rounded-lg shadow p-6">
            {activeTab && parameters[activeTab] && (
              <>
                <h2 className="text-xl font-semibold mb-4">{activeTab}</h2>
                <div className="space-y-4">
                  {renderParameterTree(parameters[activeTab].ros__parameters, [
                    activeTab,
                  ])}
                </div>
                <div className="mt-6">
                  <button
                    onClick={saveActiveTabParameters}
                    className="btn btn-primary"
                  >
                    Save All Changes
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
