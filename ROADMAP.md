# Derby Roadmap

This document outlines the development roadmap for Derby, including version strategy and planned features.

## Version Strategy

Derby follows [Semantic Versioning](https://semver.org/) (SemVer):

- **MAJOR** version (x.0.0): Breaking changes
- **MINOR** version (0.x.0): New features (backward compatible)
- **PATCH** version (0.0.x): Bug fixes and minor improvements

## Current Version

**0.1.0** - Initial release with core functionality:
- [x] HTTP API for SQL query execution
- [x] WebSocket JSON-RPC 2.0 interface
- [x] SQLite database support
- [x] Static file serving
- [ ] PostgreSQL adapter (stub implementation available, full implementation pending)

## Roadmap

### Short Term (v0.2.x)

- [ ] Full PostgreSQL implementation
- [ ] Enhanced logging with configurable levels
- [ ] Rate limiting and request throttling
- [ ] Database connection pooling
- [ ] More examples and documentation
- [ ] API authentication middleware
- [ ] Support for SQL migrations with versioning

### Medium Term (v0.3.x - v0.4.x)

- [ ] CORS configuration improvements
- [ ] WebSocket subscription model for real-time updates
- [ ] Database schema validation
- [ ] File upload handling
- [ ] Caching layer for query results
- [ ] Plugin system for extending functionality
- [ ] Built-in support for common authentication patterns
- [ ] Command line interface (CLI) for project scaffolding

### Long Term (v0.5.x - v1.0.0)

- [ ] Additional database adapters (MySQL, MongoDB)
- [ ] GraphQL API layer
- [ ] Database schema migration tools
- [ ] Integration with popular frameworks (React, Vue, etc.)
- [ ] Performance optimizations and benchmarks
- [ ] Serverless deployment support
- [ ] WebSocket cluster support for horizontal scaling
- [ ] Comprehensive test suite with 90%+ code coverage

## Release Criteria for v1.0.0

- [ ] All core features fully implemented and tested
- [ ] Comprehensive documentation and examples
- [ ] Stable API with no planned breaking changes
- [ ] Production-ready with multiple real-world applications
- [ ] Full PostgreSQL support
- [ ] Robust error handling and logging
- [ ] Security features (authentication, rate limiting, etc.)

## Contributing

We welcome contributions to help achieve the goals in this roadmap. Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on contributing to Derby. 