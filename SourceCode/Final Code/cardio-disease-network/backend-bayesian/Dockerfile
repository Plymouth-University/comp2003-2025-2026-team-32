# 1. Use an official Python runtime as a parent image
FROM python:3.11-slim

# 2. Set the working directory in the container
WORKDIR /app

# 3. Copy the requirements file into the container
COPY requirements.txt .

# 4. Install any needed packages specified in requirements.txt
# We include curl for healthchecks
RUN apt-get update && apt-get install -y curl && \
    pip install --no-cache-dir -r requirements.txt

# 5. Copy the rest of the application code
COPY . .

# 6. Make port 8000 available to the world outside this container
EXPOSE 8000

# 7. Define environment variable to ensure output is sent straight to terminal
ENV PYTHONUNBUFFERED=1

# 8. Run the application
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]