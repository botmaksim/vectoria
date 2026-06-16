cmake_minimum_required(VERSION 3.10)
project(Vectoria)

# Docker Shortcuts
add_custom_target(docker-build
    COMMAND docker build -t vectoria-app .
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    COMMENT "Building Docker image 'vectoria-app'..."
)

add_custom_target(docker-up
    COMMAND docker run -d -p 8080:80 --name vectoria vectoria-app
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    COMMENT "Starting Docker container 'vectoria'..."
)

add_custom_target(docker-down
    COMMAND docker stop vectoria || true
    COMMAND docker rm vectoria || true
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    COMMENT "Stopping and removing Docker container 'vectoria'..."
)

add_custom_target(docker-restart
    COMMAND docker restart vectoria
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    COMMENT "Restarting Docker container 'vectoria'..."
)

# Doxygen Shortcut
add_custom_target(doxygen
    COMMAND doxygen Doxyfile
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    COMMENT "Generating Doxygen documentation..."
)
