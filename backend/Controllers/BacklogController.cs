using Microsoft.AspNetCore.Mvc;
using ProductQualityReport.Models;
using ProductQualityReport.Services;

namespace ProductQualityReport.Controllers;

[ApiController]
[Route("api/backlog")]
public class BacklogController : ControllerBase
{
    private readonly EngineeringBacklogService _service;
    private readonly DiagnosisService _diagnosis;
    private readonly ILogger<BacklogController> _logger;

    public BacklogController(
        EngineeringBacklogService service, DiagnosisService diagnosis, ILogger<BacklogController> logger)
    {
        _service = service;
        _diagnosis = diagnosis;
        _logger = logger;
    }

    [HttpGet("team-split")]
    [ProducesResponseType(typeof(EngineeringBacklogReport), StatusCodes.Status200OK)]
    public async Task<ActionResult<EngineeringBacklogReport>> GetReport(
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Engineering backlog team-split requested");
        var result = await _service.GetReportAsync(cancellationToken);
        return Ok(result);
    }

    [HttpGet("team-split/diagnosis")]
    [ProducesResponseType(typeof(List<DiagnosisCard>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<DiagnosisCard>>> GetDiagnosis(
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Engineering backlog diagnosis requested");
        var report = await _service.GetReportAsync(cancellationToken);
        var cards = await _diagnosis.GenerateAsync(report, cancellationToken);
        return Ok(cards);
    }
}
