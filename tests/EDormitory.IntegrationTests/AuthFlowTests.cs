using System.Net;
using System.Net.Http.Json;
using EDormitory.Application.Contracts.Auth;

namespace EDormitory.IntegrationTests;

public sealed class AuthFlowTests(TestWebApplicationFactory factory) : IClassFixture<TestWebApplicationFactory>
{
    [Fact]
    public async Task Login_Should_Set_Cookies_And_Return_Current_User()
    {
        var client = factory.CreateSecureClient();

        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest("student@edormitory.local", "ChangeMe123!"));
        loginResponse.EnsureSuccessStatusCode();

        var currentUserResponse = await client.GetAsync("/api/auth/me");
        currentUserResponse.EnsureSuccessStatusCode();

        var user = await currentUserResponse.Content.ReadFromJsonAsync<LoginUserProbe>();
        Assert.NotNull(user);
        Assert.Equal("student@edormitory.local", user.Email);
        Assert.Contains(loginResponse.Headers.GetValues("Set-Cookie"), value => value.Contains("edormitory_at"));
        Assert.Contains(loginResponse.Headers.GetValues("Set-Cookie"), value => value.Contains("edormitory_rt"));
    }

    [Fact]
    public async Task Student_Should_Not_Access_Admin_Users_Endpoint()
    {
        var client = factory.CreateSecureClient();
        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest("student@edormitory.local", "ChangeMe123!"));
        loginResponse.EnsureSuccessStatusCode();

        var response = await client.GetAsync("/api/users");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    private sealed record LoginUserProbe(string Email);
}
