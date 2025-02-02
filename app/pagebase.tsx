"use client";

import ROSLIB from "roslib";
import React from "react";

export default function Home() {
  const [messageData, setMessageData] = React.useState("");

  const ros = React.useMemo(() => {
    return new ROSLIB.Ros({
      url: "ws://localhost:9090",
    });
  }, []);

  ros.on("connection", () => {
    console.log("Connected to websocket server.");
  });

  ros.on("error", (error) => {
    console.error("Error connecting to websocket server: ", error);
  });

  ros.on("close", () => {
    console.log("Connection to websocket server closed.");
  });

  const listener = React.useMemo(() => {
    return new ROSLIB.Topic({
      ros: ros,
      name: "/timestamp",
      messageType: "std_msgs/String",
    });
  }, [ros]);

  listener.subscribe((message) => {
    console.log(message);
    // console.log("Received message on " + listener.name + ": " + message.data);
    setMessageData(message.data);
  });

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      {messageData}
    </div>
  );
}
