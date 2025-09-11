# Contributing

Thank you for your interest in contributing to the AI Gateway project! This document provides guidelines for contributing to the codebase, including development setup, coding standards, and the contribution process.

## Development Workflow

### Getting Started
1. **Fork the Repository**: Create your own fork of the repository
2. **Clone Your Fork**: Clone your fork to your local machine
3. **Create Feature Branch**: Create a new branch for your feature or bugfix
4. **Make Changes**: Implement your changes following the coding standards
5. **Test Changes**: Ensure your changes work correctly and don't break existing functionality
6. **Update Documentation**: Update relevant documentation if needed
7. **Submit Pull Request**: Create a pull request with a clear description of your changes

### Branch Naming
Use descriptive branch names that indicate the type of change:
- `feature/api-key-rotation` - New features
- `bugfix/rate-limit-validation` - Bug fixes
- `docs/api-documentation-update` - Documentation updates
- `refactor/database-connection-pooling` - Code refactoring

### Pull Request Guidelines
- **Keep PRs Focused**: Each PR should address a single issue or feature
- **Small and Atomic**: Prefer smaller, focused changes over large, complex ones
- **Clear Description**: Provide a clear description of what the PR does and why
- **Link Issues**: Reference any related issues in your PR description
- **Include Tests**: Add tests for new functionality when possible

## Local Development Setup

### Prerequisites
- Python 3.11+
- Git
- Supabase account (for database)
- OpenRouter API key (for testing)

### Environment Setup
```bash
# Clone your fork
git clone https://github.com/yourusername/api-gateway-vercel.git
cd api-gateway-vercel/gateway

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env  # If example exists
# Or create .env file manually with required variables
```

### Required Environment Variables
Create a `.env` file with the following variables:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key
OPENROUTER_API_KEY=sk-or-v1-your_openrouter_key
OPENROUTER_SITE_URL=https://your-site.com
OPENROUTER_SITE_NAME=Your Site Name
```

### Running the Application
```bash
# Start development server
uvicorn app:app --reload --host 0.0.0.0 --port 8000

# Access the application
# API Documentation: http://localhost:8000/docs
# Health Check: http://localhost:8000/health
```

## Coding Standards

### Python Code Style
- **PEP 8**: Follow PEP 8 style guidelines
- **Type Hints**: Use type hints for function parameters and return values
- **Docstrings**: Include docstrings for all functions, classes, and modules
- **Error Handling**: Implement proper error handling with meaningful error messages

### Code Organization
- **Modular Design**: Keep functions focused and modular
- **Separation of Concerns**: Separate business logic from API endpoints
- **Database Operations**: Use the `db.py` module for database operations
- **Configuration**: Use the `config.py` module for configuration management

### API Design
- **RESTful Design**: Follow RESTful API design principles
- **Consistent Naming**: Use consistent naming conventions for endpoints
- **Error Responses**: Provide clear, consistent error responses
- **Status Codes**: Use appropriate HTTP status codes

### Documentation
- **API Documentation**: Update API documentation when adding new endpoints
- **Code Comments**: Add comments for complex logic
- **README Updates**: Update README if needed
- **Example Code**: Provide working examples for new features

## Testing

### Running Tests
```bash
# Run all tests
python -m pytest tests/

# Run specific test file
python -m pytest tests/test_app.py

# Run with coverage
python -m pytest --cov=app tests/
```

### Writing Tests
- **Test Coverage**: Aim for good test coverage of new functionality
- **Test Organization**: Place tests in the `tests/` directory
- **Test Naming**: Use descriptive test names that explain what is being tested
- **Mock External Services**: Mock external API calls in tests

### Test Structure
```python
def test_endpoint_name():
    """Test description of what this test does."""
    # Arrange: Set up test data
    # Act: Execute the code being tested
    # Assert: Verify the expected outcome
```

## Documentation Standards

### API Documentation
- **Endpoint Descriptions**: Provide clear descriptions for all endpoints
- **Request/Response Examples**: Include working examples
- **Error Codes**: Document all possible error responses
- **Authentication**: Document authentication requirements

### Code Documentation
- **Function Docstrings**: Include purpose, parameters, and return values
- **Class Docstrings**: Describe the class purpose and usage
- **Module Docstrings**: Explain the module's purpose and contents

### Example Code
- **Working Examples**: Provide complete, working examples
- **curl Commands**: Use curl commands for API examples
- **Error Handling**: Show how to handle errors properly

## Security Considerations

### API Key Security
- **Never Commit Keys**: Never commit API keys or secrets to version control
- **Environment Variables**: Use environment variables for sensitive data
- **Key Rotation**: Implement proper key rotation mechanisms
- **Access Control**: Implement proper access control and permissions

### Input Validation
- **Validate Input**: Validate all input data
- **Sanitize Data**: Sanitize user input to prevent injection attacks
- **Rate Limiting**: Implement proper rate limiting
- **Error Messages**: Don't expose sensitive information in error messages

## Performance Considerations

### Database Operations
- **Efficient Queries**: Write efficient database queries
- **Connection Pooling**: Use connection pooling for database connections
- **Caching**: Implement caching where appropriate
- **Indexing**: Ensure proper database indexing

### API Performance
- **Response Times**: Optimize for fast response times
- **Caching**: Use caching to reduce external API calls
- **Async Operations**: Use async operations where appropriate
- **Resource Management**: Properly manage resources and connections

## Review Process

### Code Review Checklist
- [ ] Code follows the coding standards
- [ ] Tests are included and passing
- [ ] Documentation is updated
- [ ] Security considerations are addressed
- [ ] Performance implications are considered
- [ ] Error handling is appropriate
- [ ] Code is readable and maintainable

### Review Guidelines
- **Be Constructive**: Provide constructive feedback
- **Be Specific**: Point out specific issues and suggest improvements
- **Be Respectful**: Maintain a respectful and professional tone
- **Be Thorough**: Review all aspects of the code, not just functionality

## Release Process

### Version Management
- **Semantic Versioning**: Use semantic versioning for releases
- **Changelog**: Maintain a changelog for all releases
- **Breaking Changes**: Clearly document breaking changes
- **Migration Guides**: Provide migration guides for breaking changes

### Release Checklist
- [ ] All tests are passing
- [ ] Documentation is updated
- [ ] Changelog is updated
- [ ] Version number is incremented
- [ ] Release notes are prepared

## Getting Help

### Resources
- **Documentation**: Check the docs directory for detailed documentation
- **Issues**: Search existing issues before creating new ones
- **Discussions**: Use GitHub discussions for questions and ideas
- **Code Review**: Ask for help during code review

### Communication
- **Be Clear**: Provide clear descriptions of issues and questions
- **Be Patient**: Allow time for responses and reviews
- **Be Collaborative**: Work together to improve the project
- **Be Respectful**: Maintain a positive and respectful community

## License

By contributing to this project, you agree that your contributions will be licensed under the same license as the project.

## Thank You

Thank you for contributing to the AI Gateway project! Your contributions help make the project better for everyone. If you have any questions or need help getting started, please don't hesitate to reach out.
