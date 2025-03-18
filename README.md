## Robot-Side Setup

1. Run the robot's rosbridge server:

```bash
ros2 launch rosbridge_server rosbridge_websocket_launch.xml
```

2. Launch the robot's quintic walk:

```bash
ros2 launch quintic_walk controller.launch.py
```

3. Launch the robot's moveit:

```bash
ros2 launch altair_moveit_config move_group.launch.py
```

4. Launch the param-manager service:

```bash
ros2 launch param_manager param_manager.launch.py
```

## Client-Side Setup

### Prerequisites

- Node.js
- npm

1. Clone the repository

  ```bash
  git clone
  ```

2. Install dependencies

  ```bash
  npm install
  ```

3. Start the development server

  ```bash
  npm run dev
  ```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
