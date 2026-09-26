"""
Fargate Performance & Traffic Volume Benchmark
Executes concurrent request bursts against the Fargate application container
measuring throughput, response latency, and error rate without static formulas.
"""
import argparse
import asyncio
import time
import httpx


async def send_probe(client: httpx.AsyncClient, url: str) -> tuple[int, float]:
    start = time.perf_counter()
    try:
        resp = await client.get(f"{url}/health/live")
        latency = (time.perf_counter() - start) * 1000
        return resp.status_code, latency
    except Exception:
        latency = (time.perf_counter() - start) * 1000
        return 500, latency


async def run_benchmark(base_url: str, total_requests: int = 500, concurrency: int = 25):
    print("=" * 72)
    print("  Amazon ECS Fargate - Container Traffic Volume & Performance Test")
    print("=" * 72)
    print(f"  Target Endpoint:   {base_url}/health/live")
    print(f"  Total Requests:    {total_requests}")
    print(f"  Concurrency Level: {concurrency} workers")
    print("-" * 72)

    limits = httpx.Limits(max_connections=concurrency * 2, max_keepalive_connections=concurrency)
    timeout = httpx.Timeout(10.0)

    start_total = time.perf_counter()
    latencies = []
    success_count = 0
    fail_count = 0

    async with httpx.AsyncClient(limits=limits, timeout=timeout) as client:
        sem = asyncio.Semaphore(concurrency)

        async def worker():
            nonlocal success_count, fail_count
            async with sem:
                status, lat = await send_probe(client, base_url)
                latencies.append(lat)
                if status == 200:
                    success_count += 1
                else:
                    fail_count += 1

        tasks = [asyncio.create_task(worker()) for _ in range(total_requests)]
        await asyncio.gather(*tasks)

    elapsed_total = time.perf_counter() - start_total
    throughput = total_requests / elapsed_total if elapsed_total > 0 else 0
    avg_latency = sum(latencies) / len(latencies) if latencies else 0
    p95_latency = sorted(latencies)[int(len(latencies) * 0.95)] if latencies else 0
    error_rate = (fail_count / total_requests) * 100 if total_requests > 0 else 0

    print(f"  Requests Completed: {success_count} / {total_requests} ({(success_count/total_requests)*100:.1f}%)")
    print(f"  Failed Requests:    {fail_count} ({error_rate:.2f}%)")
    print(f"  Total Duration:     {elapsed_total:.2f} s")
    print(f"  Throughput:         {throughput:.1f} req/s")
    print(f"  Avg Latency:        {avg_latency:.2f} ms")
    print(f"  P95 Latency:        {p95_latency:.2f} ms")
    print("=" * 72)
    if error_rate == 0.0:
        print("  RESULT: SUCCESS - 100% Availability, 0 Dropped Packets under load.")
    else:
        print(f"  RESULT: FAILED - {fail_count} requests dropped.")
    print("=" * 72)


def main():
    parser = argparse.ArgumentParser(description="Fargate Performance Benchmark")
    parser.add_argument("--url", default="http://127.0.0.1:8000", help="Base URL of application")
    parser.add_argument("--requests", type=int, default=500, help="Total requests to dispatch")
    parser.add_argument("--concurrency", type=int, default=25, help="Concurrent workers")
    args = parser.parse_args()

    asyncio.run(run_benchmark(args.url.rstrip("/"), args.requests, args.concurrency))


if __name__ == "__main__":
    main()
