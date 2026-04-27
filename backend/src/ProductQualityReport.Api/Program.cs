using ProductQualityReport.Jira;
using ProductQualityReport.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddMemoryCache();

// Jira configuration
builder.Services.Configure<JiraConfiguration>(
    builder.Configuration.GetSection(JiraConfiguration.SectionName));

// HttpClient for Jira
builder.Services.AddHttpClient<JiraApiService>();

// App services
builder.Services.AddScoped<JiraApiService>();
builder.Services.AddScoped<ReportService>();

// CORS — allow the frontend dev server and GitHub Pages
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins(
            "http://localhost:4200",
            "https://darynapedan.github.io")
        .AllowAnyHeader()
        .AllowAnyMethod());
});

var app = builder.Build();

app.UseCors();
app.MapControllers();

app.Run();
