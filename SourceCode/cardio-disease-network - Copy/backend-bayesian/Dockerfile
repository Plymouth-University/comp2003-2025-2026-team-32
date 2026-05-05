# 1. Use an official Python runtime as a parent image
FROM python:3.11-slim

# 2. Set environment variables to improve container performance and behavior
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# 3. Install system dependencies and clean up apt cache
# We include curl for healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# 4. Create and switch to a new non-root user for security
RUN useradd --create-home appuser
WORKDIR /home/appuser/app
USER appuser

# 5. Copy and install Python dependencies as the non-root user
# This leverages Docker's layer caching
COPY --chown=appuser:appuser requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# 6. Copy the rest of the application code
COPY --chown=appuser:appuser . .

# 7. Make port 8000 available to the world outside this container
EXPOSE 8000

# 8. Add a healthcheck to ensure the application is running correctly
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/ || exit 1

# 9. Run the application, adding the user's local bin to the PATH
ENV PATH="/home/appuser/.local/bin:${PATH}"
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]