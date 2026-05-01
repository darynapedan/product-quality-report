using System.Diagnostics;
using System.Text.Json;
using ProductQualityReport.Models;

namespace ProductQualityReport.Services;

public class DiagnosisService
{
    private readonly ILogger<DiagnosisService> _logger;

    public DiagnosisService(ILogger<DiagnosisService> logger)
    {
        _logger = logger;
    }

    public async Task<List<DiagnosisCard>> GenerateAsync(EngineeringBacklogReport report, CancellationToken ct = default)
    {
        var reportJson = JsonSerializer.Serialize(report, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = true
        });

        var prompt = $"""
You are an engineering manager analyzing a backlog health report for two teams: Data Services (DS) and Engineering (ENG).

Here is the current report data:
{reportJson}

Generate exactly 3 diagnosis cards as a JSON array. Each card must have:
- "team": "DS", "ENG", or "CROSS"
- "heading": a short headline (5-8 words)
- "finding": 1-2 sentences with specific numbers from the data. Reference actual ticket counts, percentages, and engineer names where relevant.
- "action": 1-2 concrete, actionable recommendations based on the findings.

Card 1: Data Services team diagnosis
Card 2: Engineering team diagnosis
Card 3: Cross-team observation and recommendation

Respond ONLY with the JSON array, no markdown fences or other text.
""";

        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = "claude",
                ArgumentList = { "-p", prompt, "--output-format", "text" },
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };

            using var process = Process.Start(psi);
            if (process == null)
            {
                _logger.LogError("Failed to start claude CLI process");
                return new List<DiagnosisCard>();
            }

            var output = await process.StandardOutput.ReadToEndAsync(ct);
            var error = await process.StandardError.ReadToEndAsync(ct);
            await process.WaitForExitAsync(ct);

            if (process.ExitCode != 0)
            {
                _logger.LogError("claude CLI exited with code {Code}: {Error}", process.ExitCode, error);
                return new List<DiagnosisCard>();
            }

            var text = output.Trim();
            var cards = JsonSerializer.Deserialize<List<DiagnosisCard>>(text, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            return cards ?? new List<DiagnosisCard>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to generate AI diagnosis via claude CLI");
            return new List<DiagnosisCard>();
        }
    }
}
