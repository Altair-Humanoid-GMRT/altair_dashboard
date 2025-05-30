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
    if (typeof window === "undefined") {
      return "ws://localhost:9090";
    }
    return localStorage.getItem("ros_connection_uri") || "ws://localhost:9090";
  });
  const [robotNamespace, setRobotNamespace] = useState(() => {
    if (typeof window === "undefined") {
      return "/quintic_walk";
    }
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

  // Mock mode state
  const [mockMode, setMockMode] = useState(false);

  // Mock data based on sample-param.yaml
  const mockParameters = {
    "quintic_walk.engine.freq": { value: 1.85, type: 3 },
    "quintic_walk.engine.double_support_ratio": { value: 0.045, type: 3 },
    "quintic_walk.engine.first_step_swing_factor": { value: 0.7, type: 3 },
    "quintic_walk.engine.first_step_trunk_phase": { value: -0.25, type: 3 },
    "quintic_walk.engine.foot_apex_phase": { value: 0.5, type: 3 },
    "quintic_walk.engine.foot_apex_pitch": { value: 0.0, type: 3 },
    "quintic_walk.engine.foot_distance": { value: 0.18, type: 3 },
    "quintic_walk.engine.foot_overshoot_phase": { value: 0.85, type: 3 },
    "quintic_walk.engine.foot_overshoot_ratio": { value: 0.05, type: 3 },
    "quintic_walk.engine.foot_put_down_phase": { value: 1.0, type: 3 },
    "quintic_walk.engine.foot_put_down_z_offset": { value: 0.0, type: 3 },
    "quintic_walk.engine.foot_rise": { value: 0.04, type: 3 },
    "quintic_walk.engine.foot_z_pause": { value: 0.0, type: 3 },
    "quintic_walk.engine.kick_length": { value: 0.12, type: 3 },
    "quintic_walk.engine.kick_phase": { value: 0.28, type: 3 },
    "quintic_walk.engine.kick_put_down_phase": { value: 0.8, type: 3 },
    "quintic_walk.engine.kick_rise_factor": { value: 1.5, type: 3 },
    "quintic_walk.engine.kick_vel": { value: 0.2, type: 3 },
    "quintic_walk.engine.trunk_height": { value: 0.2, type: 3 },
    "quintic_walk.engine.trunk_pause": { value: 0.3, type: 3 },
    "quintic_walk.engine.trunk_phase": { value: 0.6, type: 3 },
    "quintic_walk.engine.trunk_pitch": { value: 0.2, type: 3 },
    "quintic_walk.engine.trunk_pitch_p_coef_forward": { value: 0.0, type: 3 },
    "quintic_walk.engine.trunk_pitch_p_coef_turn": { value: 0.0, type: 3 },
    "quintic_walk.engine.trunk_swing": { value: 0.062, type: 3 },
    "quintic_walk.engine.trunk_x_offset": { value: -0.004, type: 3 },
    "quintic_walk.engine.trunk_x_offset_p_coef_forward": {
      value: 0.5,
      type: 3,
    },
    "quintic_walk.engine.trunk_x_offset_p_coef_turn": { value: 0.0, type: 3 },
    "quintic_walk.engine.trunk_y_offset": { value: 0.003, type: 3 },
    "quintic_walk.engine.trunk_z_movement": { value: 0.0, type: 3 },
    "quintic_walk.node.debug_active": { value: true, type: 1 },
    "quintic_walk.node.engine_freq": { value: 125.0, type: 3 },
    "quintic_walk.node.ik.reset": { value: true, type: 1 },
    "quintic_walk.node.ik.timeout": { value: 0.01, type: 3 },
    "quintic_walk.node.imu_y_acc_tau": { value: 0.2, type: 3 },
    "quintic_walk.node.max_step_angular": { value: 1.0, type: 3 },
    "quintic_walk.node.max_step_x": { value: 1.0, type: 3 },
    "quintic_walk.node.max_step_xy": { value: 1.0, type: 3 },
    "quintic_walk.node.max_step_y": { value: 1.0, type: 3 },
    "quintic_walk.node.max_step_z": { value: 1.0, type: 3 },
    "quintic_walk.node.phase_reset.effort.active": { value: false, type: 1 },
    "quintic_walk.node.phase_reset.effort.joint_min_effort": {
      value: 2.0,
      type: 3,
    },
    "quintic_walk.node.phase_reset.foot_pressure.active": {
      value: false,
      type: 1,
    },
    "quintic_walk.node.phase_reset.foot_pressure.ground_min_pressure": {
      value: 1.5,
      type: 3,
    },
    "quintic_walk.node.phase_reset.imu.active": { value: false, type: 1 },
    "quintic_walk.node.phase_reset.imu.y_acceleration_threshold": {
      value: 2.0,
      type: 3,
    },
    "quintic_walk.node.phase_reset.min_phase": { value: 0.9, type: 3 },
    "quintic_walk.node.stability_stop.imu.active": { value: false, type: 1 },
    "quintic_walk.node.stability_stop.imu.pitch.threshold": {
      value: 0.19,
      type: 3,
    },
    "quintic_walk.node.stability_stop.imu.pitch.vel_threshold": {
      value: 1.3,
      type: 3,
    },
    "quintic_walk.node.stability_stop.imu.roll.threshold": {
      value: 0.4,
      type: 3,
    },
    "quintic_walk.node.stability_stop.imu.roll.vel_threshold": {
      value: 5.7,
      type: 3,
    },
    "quintic_walk.node.stability_stop.pause_duration": { value: 3.0, type: 3 },
    "quintic_walk.node.tf.base_link_frame": { value: "body_link", type: 4 },
    "quintic_walk.node.tf.l_sole_frame": { value: "l_ank_roll_link", type: 4 },
    "quintic_walk.node.tf.odom_frame": { value: "odom", type: 4 },
    "quintic_walk.node.tf.r_sole_frame": { value: "r_ank_roll_link", type: 4 },
    "quintic_walk.node.trunk_pid.pitch.antiwindup": { value: false, type: 1 },
    "quintic_walk.node.trunk_pid.pitch.d": { value: 0.004, type: 3 },
    "quintic_walk.node.trunk_pid.pitch.i": { value: 0.0, type: 3 },
    "quintic_walk.node.trunk_pid.pitch.i_clamp_max": { value: 0.0, type: 3 },
    "quintic_walk.node.trunk_pid.pitch.i_clamp_min": { value: 0.0, type: 3 },
    "quintic_walk.node.trunk_pid.pitch.p": { value: 0.0035, type: 3 },
    "quintic_walk.node.trunk_pid.roll.antiwindup": { value: false, type: 1 },
    "quintic_walk.node.trunk_pid.roll.d": { value: 0.0, type: 3 },
    "quintic_walk.node.trunk_pid.roll.i": { value: 0.0, type: 3 },
    "quintic_walk.node.trunk_pid.roll.i_clamp_max": { value: 0.0, type: 3 },
    "quintic_walk.node.trunk_pid.roll.i_clamp_min": { value: 0.0, type: 3 },
    "quintic_walk.node.trunk_pid.roll.p": { value: 0.0, type: 3 },
    "quintic_walk.node.x_bias": { value: 0.0, type: 3 },
    "quintic_walk.node.x_speed_multiplier": { value: 1.0, type: 3 },
    "quintic_walk.node.y_bias": { value: 0.0, type: 3 },
    "quintic_walk.node.y_speed_multiplier": { value: 1.0, type: 3 },
    "quintic_walk.node.yaw_bias": { value: 0.0, type: 3 },
    "quintic_walk.node.yaw_speed_multiplier": { value: 1.0, type: 3 },
  };

  const mockDescriptions = {
    "quintic_walk.engine.freq": { description: "Walking frequency in Hz" },
    "quintic_walk.engine.double_support_ratio": {
      description: "Ratio of double support phase",
    },
    "quintic_walk.engine.foot_distance": {
      description: "Distance between feet",
    },
    "quintic_walk.engine.foot_rise": {
      description: "Height of foot during swing phase",
    },
    "quintic_walk.engine.trunk_height": {
      description: "Height of the robot trunk",
    },
    "quintic_walk.node.debug_active": { description: "Enable debug mode" },
    "quintic_walk.node.engine_freq": { description: "Engine update frequency" },
    "quintic_walk.node.max_step_x": {
      description: "Maximum step in X direction",
    },
    "quintic_walk.node.max_step_y": {
      description: "Maximum step in Y direction",
    },
    // Add more descriptions as needed
  };

  const mockHistoryFiles = [
    {
      filename: "config_2024_01_15_14_30.yaml",
      path: "/mock/history/config_2024_01_15_14_30.yaml",
      modified: "2024-01-15 14:30:25",
    },
    {
      filename: "config_2024_01_15_10_15.yaml",
      path: "/mock/history/config_2024_01_15_10_15.yaml",
      modified: "2024-01-15 10:15:12",
    },
    {
      filename: "config_2024_01_14_16_45.yaml",
      path: "/mock/history/config_2024_01_14_16_45.yaml",
      modified: "2024-01-14 16:45:08",
    },
  ];

  // Load selected parameters from localStorage
  useEffect(() => {
    try {
      if (typeof window === "undefined") {
        return;
      }
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
          setTimeout(() => {
            // Execute play with current parameters
            handlePlayRobot(0, 0, 0);

            // Stop after a brief period
            setTimeout(() => {
              handleStopRobot();
            }, 100); // 500ms duration for the command to execute
          }, 300); // Wait for parameters to be applied
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
    if (mockMode) {
      mockSaveParameters();
      return;
    }

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

  // State for logs
  const [logs, setLogs] = useState([]);

  // Function to add log entry
  const addLog = (message, type = "info", details = null) => {
    const timestamp = new Date().toLocaleTimeString();
    const newLog = {
      id: Date.now() + Math.random(),
      timestamp,
      message,
      type, // 'info', 'success', 'error', 'warning', 'websocket'
      details,
    };
    setLogs((prev) => [newLog, ...prev].slice(0, 100)); // Keep only last 100 logs
  };

  // Function to clear logs
  const clearLogs = () => {
    setLogs([]);
  };

  // Function to handle editing a parameter
  const handleEdit = (paramName, currentValue) => {
    setEditingParam(paramName);
    setNewValue(currentValue?.toString() || "");
    addLog(`Started editing parameter: ${paramName}`, "info");
  };

  // Function to save the edited parameter
  const handleSave = () => {
    if (editingParam && newValue !== "") {
      addLog(`Saving parameter: ${editingParam} = ${newValue}`, "info");
      if (mockMode) {
        mockUpdateParameter(editingParam, newValue);
      } else {
        updateParameter(editingParam, newValue);
      }
      setEditingParam(null);
      setNewValue("");
    }
  };

  // State for local editing in command parameters
  const [localEditingCmdParam, setLocalEditingCmdParam] = useState(null);
  const [localCmdValue, setLocalCmdValue] = useState("");
  const cmdInputRef = useRef(null);

  // Focus input when editing command parameter starts
  useEffect(() => {
    if (localEditingCmdParam && cmdInputRef.current) {
      cmdInputRef.current.focus();
      cmdInputRef.current.select();
    }
  }, [localEditingCmdParam]);

  // Handle single-click to edit command parameter
  const handleCmdSingleClick = (paramName, currentValue) => {
    setLocalEditingCmdParam(paramName);
    setLocalCmdValue(currentValue?.toString() || "");
    addLog(`Started editing command parameter: ${paramName}`, "info");
  };

  // Handle key press in command parameter input
  const handleCmdKeyPress = (e, paramName) => {
    if (e.key === "Enter") {
      handleCmdSaveLocal(paramName);
    } else if (e.key === "Escape") {
      handleCmdCancelEdit();
    }
  };

  // Handle save command parameter
  const handleCmdSaveLocal = (paramName) => {
    if (localCmdValue !== "") {
      const newValue = parseFloat(localCmdValue);
      setCmdParams((prevCmdParams) => ({
        ...prevCmdParams,
        [paramName]: newValue,
      }));
      addLog(
        `Updated command parameter: ${paramName} = ${newValue}`,
        "success"
      );
    }
    setLocalEditingCmdParam(null);
    setLocalCmdValue("");
  };

  // Handle cancel edit command parameter
  const handleCmdCancelEdit = () => {
    addLog(`Cancelled editing command parameter`, "warning");
    setLocalEditingCmdParam(null);
    setLocalCmdValue("");
  };

  // Handle input blur for command parameters
  const handleCmdBlur = (paramName) => {
    handleCmdSaveLocal(paramName);
  };

  // Function to handle parameter selection changes
  const handleParamSelectionChange = (paramName, isSelected) => {
    setSelectedParams((prev) => {
      const updated = {
        ...prev,
        [paramName]: isSelected,
      };
      // Save to localStorage
      localStorage.setItem("selected_parameters", JSON.stringify(updated));
      return updated;
    });
    addLog(
      `Parameter ${paramName} ${isSelected ? "selected" : "deselected"}`,
      "info"
    );
  };

  // Function to handle select all parameters
  const handleSelectAllParams = (selectAll) => {
    const updated = {};
    Object.keys(parameters).forEach((param) => {
      updated[param] = selectAll;
    });
    setSelectedParams(updated);
    localStorage.setItem("selected_parameters", JSON.stringify(updated));
    addLog(
      `${selectAll ? "Selected" : "Deselected"} all parameters (${
        Object.keys(parameters).length
      } total)`,
      "info"
    );
  };

  // Function to apply settings from ConnectionManager
  const applySettings = (newUri, newNamespace) => {
    setConnectionUri(newUri);
    setRobotNamespace(newNamespace);
    setShowSettingsModal(false);

    // Save to localStorage
    localStorage.setItem("ros_connection_uri", newUri);
    localStorage.setItem("ros_robot_namespace", newNamespace);

    // Reinitialize connection with new settings
    setRetryCount(0);
    initRosConnection();

    addLog(
      `Settings updated: URI=${newUri}, Namespace=${newNamespace}`,
      "info"
    );

    setModalType("success");
    setModalMessage("Connection settings updated successfully");
    setShowModal(true);
  };

  const handlePlayRobot = (x, y, z) => {
    addLog(`Robot command: Play (x:${x}, y:${y}, z:${z})`, "info");

    if (mockMode) {
      mockHandlePlayRobot(x, y, z);
      return;
    }

    if (!rosRef.current || connectionStatus !== "connected") {
      const errorMsg = "Cannot control robot: ROS connection not established";
      addLog(errorMsg, "error");
      setModalType("error");
      setModalMessage(errorMsg);
      setShowModal(true);
      return;
    }

    console.log("Sending cmd_vel", { x, y, z });
    addLog(`Publishing to /cmd_vel topic`, "websocket");

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
    addLog(`Published twist message to /cmd_vel`, "success", {
      linear: { x, y, z: 0.0 },
      angular: { x: 0.0, y: 0.0, z },
    });
  };

  const handleStopRobot = () => {
    addLog(`Robot command: Stop`, "info");

    if (mockMode) {
      mockHandleStopRobot();
      return;
    }

    if (!rosRef.current || connectionStatus !== "connected") {
      const errorMsg = "Cannot control robot: ROS connection not established";
      addLog(errorMsg, "error");
      setModalType("error");
      setModalMessage(errorMsg);
      setShowModal(true);
      return;
    }

    addLog(`Publishing stop command to /cmd_vel`, "websocket");

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
    addLog(`Published stop message to /cmd_vel`, "success", {
      linear: { x: 0.0, y: 0.0, z: 0.0 },
      angular: { x: -1.0, y: 0.0, z: 0.0 },
    });
  };

  const handleRobotKick = () => {
    addLog(`Robot command: Kick`, "info");

    if (mockMode) {
      mockHandleRobotKick();
      return;
    }

    if (!rosRef.current || connectionStatus !== "connected") {
      const errorMsg = "Cannot control robot: ROS connection not established";
      addLog(errorMsg, "error");
      setModalType("error");
      setModalMessage(errorMsg);
      setShowModal(true);
      return;
    }

    handlePlayRobot(0, 0, 0);

    addLog(`Publishing kick command to /kick topic`, "websocket");

    const cmdVel = new ROSLIB.Topic({
      ros: rosRef.current,
      name: "/kick",
      messageType: "std_msgs/msg/Bool",
    });

    const kick = new ROSLIB.Message({
      data: true,
    });

    cmdVel.publish(kick);
    addLog(`Published kick message to /kick`, "success", { data: true });

    handleStopRobot();
  };

  // Mock ROS functions
  const createMockRos = () => {
    return {
      on: (event, callback) => {
        if (event === "connection") {
          setTimeout(() => callback(), 100);
        }
      },
      removeAllListeners: () => {},
      close: () => {},
    };
  };

  const mockUpdateParameter = (paramName, value) => {
    console.log(`Mock: Updating parameter ${paramName} to ${value}`);

    // Simulate parameter update with delay
    setTimeout(() => {
      setParameters((prev) => ({
        ...prev,
        [paramName]: {
          ...prev[paramName],
          value: convertValueByType(value, prev[paramName]?.type),
        },
      }));

      setModalType("success");
      setModalMessage(
        `Parameter ${paramName} updated successfully (Mock Mode)`
      );
      setShowModal(true);
    }, 500);
  };

  const convertValueByType = (value, type) => {
    switch (type) {
      case 1: // PARAMETER_BOOL
        return value === "true" || value === true;
      case 2: // PARAMETER_INTEGER
        return parseInt(value, 10);
      case 3: // PARAMETER_DOUBLE
        return parseFloat(value);
      case 4: // PARAMETER_STRING
        return value;
      case 9: // PARAMETER_STRING_ARRAY
        return Array.isArray(value) ? value : value.split(",");
      default:
        return value;
    }
  };

  const mockSaveParameters = () => {
    console.log("Mock: Saving parameters");
    setIsLoadingSave(true);

    setTimeout(() => {
      setIsLoadingSave(false);
      setModalType("success");
      setModalMessage("Parameters saved successfully (Mock Mode)");
      setShowModal(true);
    }, 1000);
  };

  const mockHandlePlayRobot = (x, y, z) => {
    console.log(`Mock: Play robot with x:${x}, y:${y}, z:${z}`);
    setModalType("success");
    setModalMessage(`Robot command sent: x:${x}, y:${y}, z:${z} (Mock Mode)`);
    setShowModal(true);
  };

  const mockHandleStopRobot = () => {
    console.log("Mock: Stop robot");
    setModalType("success");
    setModalMessage("Robot stopped (Mock Mode)");
    setShowModal(true);
  };

  const mockHandleRobotKick = () => {
    console.log("Mock: Robot kick");
    setModalType("success");
    setModalMessage("Robot kick executed (Mock Mode)");
    setShowModal(true);
  };

  // Toggle mock mode
  const toggleMockMode = () => {
    const newMockMode = !mockMode;
    setMockMode(newMockMode);

    if (newMockMode) {
      // Enable mock mode
      setConnectionStatus("connected");
      setParameters(mockParameters);
      setParamDescriptions(mockDescriptions);
      rosRef.current = createMockRos();

      setModalType("success");
      setModalMessage("Mock mode enabled - no ROS connection required");
      setShowModal(true);
    } else {
      // Disable mock mode - reconnect to real ROS
      setConnectionStatus("disconnected");
      setParameters({});
      setParamDescriptions({});
      initRosConnection();

      setModalType("success");
      setModalMessage("Mock mode disabled - attempting real ROS connection");
      setShowModal(true);
    }
  };

  return (
    <div className="min-h-screen p-6 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl floating"></div>
        <div
          className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-400/10 rounded-full blur-3xl floating"
          style={{ animationDelay: "3s" }}
        ></div>
        <div
          className="absolute top-3/4 left-3/4 w-48 h-48 bg-blue-400/10 rounded-full blur-3xl floating"
          style={{ animationDelay: "1.5s" }}
        ></div>
      </div>

      {/* Header */}
      <header className="relative z-10 mb-8">
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg
                    className="w-7 h-7 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent">
                  Altair Dashboard
                </h1>
              </div>

              <div
                className={`px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm border transition-all duration-300 status-indicator ${
                  connectionStatus === "connected"
                    ? "bg-emerald-500/20 text-emerald-100 border-emerald-400/30 glow-green"
                    : connectionStatus === "error"
                    ? "bg-red-500/20 text-red-100 border-red-400/30 glow-red"
                    : "bg-amber-500/20 text-amber-100 border-amber-400/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      connectionStatus === "connected"
                        ? "bg-emerald-400"
                        : connectionStatus === "error"
                        ? "bg-red-400"
                        : "bg-amber-400"
                    }`}
                  ></div>
                  {connectionStatus === "connected"
                    ? "Connected"
                    : connectionStatus === "error"
                    ? "Connection Error"
                    : "Disconnected"}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              {/* Mock Mode Toggle */}
              <button
                onClick={toggleMockMode}
                className={`glass-button px-6 py-3 rounded-xl font-medium text-white transition-all duration-300 ${
                  mockMode
                    ? "bg-gradient-to-r from-orange-500/30 to-red-500/30 border-orange-400/40"
                    : "border-gray-400/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {mockMode ? "Mock Mode ON" : "Mock Mode OFF"}
                </div>
              </button>

              <button
                onClick={() => setShowSettingsModal(true)}
                className="glass-button px-6 py-3 rounded-xl font-medium text-white border-gray-400/30"
              >
                <div className="flex items-center gap-3">
                  <svg
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
                className="glass-button px-6 py-3 rounded-xl font-medium text-white border-blue-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={connectionStatus !== "connected"}
              >
                <div className="flex items-center gap-3">
                  <svg
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
                </div>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Command Parameters with Logs */}
      <div className="relative z-10 mb-8">
        <div className="glass-card rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent">
            Command Parameters & Activity Logs
          </h2>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* Command Parameters Table */}
            <div className="glass-card rounded-xl p-6">
              <h3 className="text-xl font-semibold mb-4 text-white/90">
                Control Parameters
              </h3>
              <div className="overflow-hidden rounded-xl">
                <table className="w-full">
                  <thead>
                    <tr className="bg-white/10 backdrop-blur-sm">
                      <th className="text-left p-4 text-white/80 font-semibold text-sm">
                        Parameter
                      </th>
                      <th className="text-left p-4 text-white/80 font-semibold text-sm">
                        Value
                      </th>
                      <th className="text-left p-4 text-white/80 font-semibold text-sm">
                        Type
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(cmdParams).map(
                      ([paramName, paramValue], index) => {
                        const isEditing = localEditingCmdParam === paramName;
                        return (
                          <tr
                            key={paramName}
                            className={`${
                              index % 2 === 0 ? "bg-white/5" : "bg-white/10"
                            } hover:bg-white/20 transition-all duration-200 group`}
                          >
                            <td className="p-4 text-white/90 font-medium">
                              {paramName}
                            </td>
                            <td className="p-4">
                              {isEditing ? (
                                <input
                                  ref={cmdInputRef}
                                  type="number"
                                  step="0.1"
                                  value={localCmdValue}
                                  onChange={(e) =>
                                    setLocalCmdValue(e.target.value)
                                  }
                                  onKeyDown={(e) =>
                                    handleCmdKeyPress(e, paramName)
                                  }
                                  onBlur={() => handleCmdBlur(paramName)}
                                  className="w-full p-3 bg-white/20 backdrop-blur-sm border border-blue-400/50 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400"
                                  placeholder="Press Enter to save, Escape to cancel"
                                />
                              ) : (
                                <div
                                  className="font-mono bg-white/10 backdrop-blur-sm p-3 rounded-lg text-white cursor-pointer hover:bg-white/20 transition-all duration-200 border border-white/20 hover:border-white/40"
                                  onClick={() =>
                                    handleCmdSingleClick(paramName, paramValue)
                                  }
                                  title="Click to edit"
                                >
                                  <div className="flex items-center justify-between">
                                    <span>
                                      {paramValue?.toString() || "0.0"}
                                    </span>
                                    <span className="text-blue-300 opacity-0 group-hover:opacity-100 transition-opacity">
                                      ✏️
                                    </span>
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="p-4">
                              <span className="px-3 py-1 bg-purple-500/20 text-purple-200 rounded-full text-xs font-medium border border-purple-400/30">
                                double
                              </span>
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 text-sm text-white/60 bg-white/5 rounded-lg p-3 border border-white/10">
                💡 Click on any value to edit it. Press Enter to save or Escape
                to cancel.
              </div>
            </div>

            {/* Logs Panel */}
            <div className="glass-card rounded-xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-white/90">
                  Activity Logs
                </h3>
                <button
                  onClick={clearLogs}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg text-sm transition-all duration-200 border border-red-400/30"
                >
                  Clear Logs
                </button>
              </div>

              <div className="bg-black/40 backdrop-blur-sm rounded-xl p-4 h-80 overflow-y-auto text-sm font-mono custom-scrollbar border border-white/10">
                {logs.length === 0 ? (
                  <div className="text-white/40 text-center py-16">
                    <div className="text-2xl mb-2">📋</div>
                    <div>No logs yet. Perform actions to see logs here.</div>
                  </div>
                ) : (
                  logs.map((log) => (
                    <div
                      key={log.id}
                      className="mb-3 p-2 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-white/50 shrink-0 text-xs">
                          [{log.timestamp}]
                        </span>
                        <span
                          className={`shrink-0 text-xs font-bold px-2 py-1 rounded ${
                            log.type === "info"
                              ? "bg-blue-500/20 text-blue-300"
                              : log.type === "success"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : log.type === "error"
                              ? "bg-red-500/20 text-red-300"
                              : log.type === "warning"
                              ? "bg-amber-500/20 text-amber-300"
                              : log.type === "websocket"
                              ? "bg-purple-500/20 text-purple-300"
                              : "bg-gray-500/20 text-gray-300"
                          }`}
                        >
                          {log.type.toUpperCase()}
                        </span>
                        <span className="text-white/80 break-words flex-1">
                          {log.message}
                        </span>
                      </div>
                      {log.details && (
                        <div className="mt-2 ml-6 text-white/60 bg-white/5 rounded p-2 border border-white/10">
                          <pre className="text-xs whitespace-pre-wrap overflow-x-auto">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Log Legend */}
              <div className="mt-4 text-xs">
                <div className="text-white/70 font-medium mb-2">Log Types:</div>
                <div className="flex flex-wrap gap-3">
                  {[
                    { type: "info", color: "bg-blue-500", label: "INFO" },
                    {
                      type: "success",
                      color: "bg-emerald-500",
                      label: "SUCCESS",
                    },
                    { type: "error", color: "bg-red-500", label: "ERROR" },
                    {
                      type: "warning",
                      color: "bg-amber-500",
                      label: "WARNING",
                    },
                    {
                      type: "websocket",
                      color: "bg-purple-500",
                      label: "WEBSOCKET",
                    },
                  ].map(({ type, color, label }) => (
                    <div key={type} className="flex items-center gap-2">
                      <div className={`w-3 h-3 ${color} rounded-full`}></div>
                      <span className="text-white/60">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Robot Controls */}
      <div className="fixed bottom-8 right-8 z-50">
        <div className="flex flex-col gap-4">
          {[
            {
              action: () =>
                handlePlayRobot(cmdParams.x, cmdParams.y, cmdParams.z),
              icon: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-4-4a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-2.293 2.293a1 1 0 101.414 1.414l4-4a1 1 0 000-1.414z",
              label: "Play",
              bgClass:
                "from-emerald-500/30 to-green-600/30 border-emerald-400/40 glow-green",
              hoverClass: "hover:from-emerald-400/40 hover:to-green-500/40",
            },
            {
              action: handleStopRobot,
              icon: "M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z",
              label: "Stop",
              bgClass:
                "from-red-500/30 to-red-600/30 border-red-400/40 glow-red",
              hoverClass: "hover:from-red-400/40 hover:to-red-500/40",
            },
            {
              action: handleRobotKick,
              icon: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z",
              label: "Kick",
              bgClass: "from-amber-500/30 to-orange-600/30 border-amber-400/40",
              hoverClass: "hover:from-amber-400/40 hover:to-orange-500/40",
            },
          ].map((button, index) => (
            <button
              key={button.label}
              onClick={button.action}
              className={`glass-button bg-gradient-to-r ${button.bgClass} ${button.hoverClass} w-28 h-16 rounded-2xl font-medium text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105`}
              disabled={connectionStatus !== "connected"}
              title={button.label}
            >
              <div className="flex flex-col items-center gap-1">
                <svg
                  className="h-6 w-6"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path fillRule="evenodd" d={button.icon} clipRule="evenodd" />
                </svg>
                <span className="text-sm">{button.label}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Add the History Section */}
      <div className="relative z-10">
        <History
          rosRef={rosRef}
          connectionStatus={connectionStatus}
          robotNamespace={robotNamespace}
          mockMode={mockMode}
          onRestore={() => {
            setModalType("success");
            setModalMessage("Parameters restored successfully");
            setShowModal(true);
            handleRefresh();
          }}
          onRefresh={handleRefresh}
        />
      </div>

      {/* Parameters */}
      <div className="relative z-10">
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
      </div>

      {/* Save Button */}
      <div className="relative z-10 flex justify-center mb-8">
        <button
          onClick={saveParameters}
          className="glass-button bg-gradient-to-r from-blue-500/30 to-purple-600/30 border-blue-400/40 px-8 py-4 rounded-2xl font-semibold text-white transition-all duration-300 disabled:opacity-50 hover:from-blue-400/40 hover:to-purple-500/40 transform hover:scale-105 glow-blue"
          disabled={connectionStatus !== "connected" || isLoadingSave}
        >
          <div className="flex items-center gap-3">
            {isLoadingSave ? (
              <>
                <svg
                  className="animate-spin h-6 w-6 text-white"
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
                <span className="text-lg">Saving...</span>
              </>
            ) : (
              ((
                <>
                  <svg
                    className="h-6 w-6"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z" />
                  </svg>
                </>
              ),
              (
                <span className="text-lg">
                  Save Selected Parameters to File
                </span>
              ))
            )}
          </div>
        </button>
      </div>

      {/* Modal for saving parameters status */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-card rounded-2xl p-8 max-w-md w-full mx-4 border border-white/20">
            <div className="flex justify-between items-center mb-6">
              <h3
                className={`text-xl font-bold ${
                  modalType === "success"
                    ? "text-emerald-200"
                    : modalType === "warning"
                    ? "text-amber-200"
                    : "text-red-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      modalType === "success"
                        ? "bg-emerald-500/20"
                        : modalType === "warning"
                        ? "bg-amber-500/20"
                        : "bg-red-500/20"
                    }`}
                  >
                    {modalType === "success"
                      ? "✓"
                      : modalType === "warning"
                      ? "⚠"
                      : "✕"}
                  </div>
                  {modalType === "success"
                    ? "Success"
                    : modalType === "warning"
                    ? "Warning"
                    : "Error"}
                </div>
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-white/60 hover:text-white transition-colors p-1"
              >
                <svg
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
            <div className="mb-8">
              <p className="text-white/80 leading-relaxed">{modalMessage}</p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className={`glass-button px-6 py-3 rounded-xl text-white font-medium ${
                  modalType === "success"
                    ? "bg-emerald-500/20 border-emerald-400/30"
                    : modalType === "warning"
                    ? "bg-amber-500/20 border-amber-400/30"
                    : "bg-red-500/20 border-red-400/30"
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
        className="z-[1000] max-w-xs !bg-black/80 !backdrop-blur-sm !text-white !p-3 !text-sm !rounded-xl !shadow-xl !border !border-white/20"
      />
    </div>
  );
}
