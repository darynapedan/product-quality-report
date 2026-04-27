using Microsoft.AspNetCore.Mvc;
using ProductQualityReport.Models;
using ProductQualityReport.Services;

namespace ProductQualityReport.Controllers;

[ApiController]
[Route("api/trend")]
public class ReportController : ControllerBase
{
    private readonly ReportService _reportService;
    private readonly ILogger<ReportController> _logger;

    public ReportController(ReportService reportService, ILogger<ReportController> logger)
    {
        _reportService = reportService;
        _logger = logger;
    }

    [HttpGet("product-quality-monthly")]
    [ProducesResponseType(typeof(ProductQualityMonthlyReport), StatusCodes.Status200OK)]
    public async Task<ActionResult<ProductQualityMonthlyReport>> GetReport(
        [FromQuery] DateTime startDate,
        [FromQuery] DateTime endDate,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Product quality report: {Start} to {End}", startDate, endDate);
        var result = await _reportService.GetReportAsync(startDate, endDate, cancellationToken);
        return Ok(result);
    }
}
