FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV OTS_BASELINE_DIR=/data/baselines
ENV FUSEKI_URL=http://fuseki:3030
ENV FUSEKI_DATASET=ots
ENV FUSEKI_USER=admin
ENV FUSEKI_PASSWORD=admin

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
