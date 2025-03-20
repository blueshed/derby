# Changelog

All notable changes to Derby will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2023-03-21

### Added
- Full PostgreSQL support using Bun's built-in SQL module
- Parameter transformation for PostgreSQL
- Multi-statement query support for PostgreSQL
- Transaction support for PostgreSQL
- Comprehensive tests for PostgreSQL adapter
- PostgreSQL example server
- Enhanced error handling for database connections
- Added connection pooling for PostgreSQL
- Improved security with password masking in logs

## [0.1.2] - 2023-03-20

### Added
- Added tests for PostgreSQL adapter (stub implementation)

## [0.1.1] - 2023-03-19

### Fixed
- Fixed SQLite parameter handling

## [0.1.0] - 2023-03-18

### Added
- Initial release of Derby
- HTTP API with SQL query execution
- WebSocket server with JSON-RPC 2.0 protocol
- SQLite database adapter
- Stub for PostgreSQL database adapter
- Static file serving
- Configuration system with environment variables

### Technical Features
- Modular design with adapters for different databases
- SQL query caching for improved performance
- CORS support for cross-origin requests
- JSON-RPC 2.0 compliant WebSocket server
- Named parameter support for SQL queries 