FROM python:3.7

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV APP_ENV=production

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY . /app

RUN mkdir -p /app/uploads /app/exports /app/var/cache /var/backups/acme
RUN chmod -R 777 /app
RUN chmod 777 /var/backups/acme

EXPOSE 5000

CMD ["python", "app.py"]
