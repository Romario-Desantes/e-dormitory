using System.Net;
using System.Net.Http.Json;
using EDormitory.Application.Contracts.Directories;
using EDormitory.Application.Contracts.Notifications;
using EDormitory.Application.Contracts.Rooms;
using EDormitory.Application.Contracts.Users;

namespace EDormitory.IntegrationTests;

public sealed class RegressionFeatureTests(TestWebApplicationFactory factory) : IClassFixture<TestWebApplicationFactory>
{
    [Fact]
    public async Task CreateUser_Should_Return_Conflict_When_Room_Is_Full()
    {
        await factory.ResetDatabaseAsync();
        var adminClient = await factory.CreateAuthenticatedClientAsync("admin@edormitory.local");
        var accountantClient = await factory.CreateAuthenticatedClientAsync("accountant@edormitory.local");
        var targetRoom = await GetRoomByNumberAsync(adminClient, "102");
        var baselineCharges = await GetChargesAsync(accountantClient);

        for (var index = 1; index <= targetRoom.Capacity; index++)
        {
            var createResponse = await adminClient.PostAsJsonAsync("/api/users", BuildStudentRequest($"room-102-{index}", targetRoom.Id));
            createResponse.EnsureSuccessStatusCode();
        }

        var overflowResponse = await adminClient.PostAsJsonAsync("/api/users", BuildStudentRequest("room-102-overflow", targetRoom.Id));

        Assert.Equal(HttpStatusCode.Conflict, overflowResponse.StatusCode);
        var error = await overflowResponse.Content.ReadFromJsonAsync<ApiError>();
        Assert.NotNull(error);
        Assert.Contains("вільних місць", error.Detail, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ReviewRelocation_Should_Return_Conflict_When_Target_Room_Becomes_Full()
    {
        await factory.ResetDatabaseAsync();
        var adminClient = await factory.CreateAuthenticatedClientAsync("admin@edormitory.local");
        var studentClient = await factory.CreateAuthenticatedClientAsync("student@edormitory.local");
        var commandantClient = await factory.CreateAuthenticatedClientAsync("commandant@edormitory.local");
        var targetRoom = await GetRoomByNumberAsync(adminClient, "201");

        var relocationResponse = await studentClient.PostAsJsonAsync(
            "/api/rooms/relocations",
            new CreateRelocationRequest(targetRoom.Id, "Потрібна інша кімната ближче до навчального блоку."));

        relocationResponse.EnsureSuccessStatusCode();
        var relocation = await relocationResponse.Content.ReadFromJsonAsync<RelocationRequestResponse>();
        Assert.NotNull(relocation);

        for (var index = 1; index <= targetRoom.Capacity; index++)
        {
            var createResponse = await adminClient.PostAsJsonAsync("/api/users", BuildStudentRequest($"room-201-{index}", targetRoom.Id));
            createResponse.EnsureSuccessStatusCode();
        }

        var reviewResponse = await commandantClient.PostAsJsonAsync(
            $"/api/rooms/relocations/{relocation.Id}/review",
            new ReviewRelocationRequest(RelocationDecision.Approve, "Перевірено."));

        Assert.Equal(HttpStatusCode.Conflict, reviewResponse.StatusCode);
        var error = await reviewResponse.Content.ReadFromJsonAsync<ApiError>();
        Assert.NotNull(error);
        Assert.Contains("вільних місць", error.Detail, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task DeleteUser_Should_Hide_User_Block_Login_And_Free_Room_Seat()
    {
        await factory.ResetDatabaseAsync();
        var adminClient = await factory.CreateAuthenticatedClientAsync("admin@edormitory.local");
        var accountantClient = await factory.CreateAuthenticatedClientAsync("accountant@edormitory.local");
        var targetRoom = await GetRoomByNumberAsync(adminClient, "102");
        var baselineCharges = await GetChargesAsync(accountantClient);

        var createResponse = await adminClient.PostAsJsonAsync("/api/users", BuildStudentRequest("soft-delete-student", targetRoom.Id));
        createResponse.EnsureSuccessStatusCode();
        var createdUser = await createResponse.Content.ReadFromJsonAsync<UserResponse>();
        Assert.NotNull(createdUser);

        var roomsAfterCreate = await GetRoomsAsync(adminClient);
        Assert.Equal(1, roomsAfterCreate.Single(room => room.Id == targetRoom.Id).Occupied);

        var deleteResponse = await adminClient.DeleteAsync($"/api/users/{createdUser.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var usersAfterDelete = await GetUsersAsync(adminClient);
        Assert.DoesNotContain(usersAfterDelete, user => user.Id == createdUser.Id);

        var chargesAfterDelete = await GetChargesAsync(accountantClient);
        Assert.Equal(baselineCharges.Count, chargesAfterDelete.Count);
        Assert.Equal(
            baselineCharges.Sum(charge => charge.Amount - charge.PaidAmount),
            chargesAfterDelete.Sum(charge => charge.Amount - charge.PaidAmount));

        var roomsAfterDelete = await GetRoomsAsync(adminClient);
        Assert.Equal(0, roomsAfterDelete.Single(room => room.Id == targetRoom.Id).Occupied);

        var deletedUserClient = factory.CreateSecureClient();
        var loginResponse = await deletedUserClient.PostAsJsonAsync(
            "/api/auth/login",
            new EDormitory.Application.Contracts.Auth.LoginRequest(createdUser.Email, "ChangeMe123!"));

        Assert.Equal(HttpStatusCode.Forbidden, loginResponse.StatusCode);
    }

    [Fact]
    public async Task DeleteTariff_Should_Remove_It_From_Active_List()
    {
        await factory.ResetDatabaseAsync();
        var adminClient = await factory.CreateAuthenticatedClientAsync("admin@edormitory.local");
        var initialTariffs = await GetTariffsAsync(adminClient);
        var targetTariff = initialTariffs.Single(tariff => string.Equals(tariff.Name, "Комфорт", StringComparison.Ordinal));

        var deleteResponse = await adminClient.DeleteAsync($"/api/directories/tariffs/{targetTariff.Id}");

        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var tariffsAfterDelete = await GetTariffsAsync(adminClient);
        Assert.DoesNotContain(tariffsAfterDelete, tariff => tariff.Id == targetTariff.Id);
    }

    [Fact]
    public async Task Violation_Should_Create_Unread_Notification_And_Mark_Read_Should_Clear_It()
    {
        await factory.ResetDatabaseAsync();
        var adminClient = await factory.CreateAuthenticatedClientAsync("admin@edormitory.local");
        var studentClient = await factory.CreateAuthenticatedClientAsync("student@edormitory.local");
        var commandantClient = await factory.CreateAuthenticatedClientAsync("commandant@edormitory.local");
        var student = (await GetUsersAsync(adminClient)).Single(user => string.Equals(user.Email, "student@edormitory.local", StringComparison.Ordinal));

        var baselineFeed = await GetNotificationFeedAsync(studentClient);
        Assert.Equal(0, baselineFeed.UnreadCount);

        const string violationDescription = "Порушення тиші після 22:00";
        var createViolationResponse = await commandantClient.PostAsJsonAsync(
            "/api/rooms/violations",
            new CreateViolationRequest(student.Id, student.RoomId, "High", violationDescription, DateTimeOffset.UtcNow));

        createViolationResponse.EnsureSuccessStatusCode();

        var violations = await commandantClient.GetFromJsonAsync<List<ViolationResponse>>($"/api/rooms/violations?userId={student.Id}");
        Assert.NotNull(violations);
        Assert.Contains(violations, item => string.Equals(item.Description, violationDescription, StringComparison.Ordinal));

        var studentFeed = await GetNotificationFeedAsync(studentClient);
        Assert.Equal(1, studentFeed.UnreadCount);
        Assert.Contains(studentFeed.Items, item => string.Equals(item.Description, violationDescription, StringComparison.Ordinal));

        var markReadResponse = await studentClient.PostAsync("/api/notifications/read", content: null);
        Assert.Equal(HttpStatusCode.NoContent, markReadResponse.StatusCode);

        var readFeed = await GetNotificationFeedAsync(studentClient);
        Assert.Equal(0, readFeed.UnreadCount);
    }

    private static async Task<List<RoomResponse>> GetRoomsAsync(HttpClient client) =>
        await client.GetFromJsonAsync<List<RoomResponse>>("/api/rooms") ?? [];

    private static async Task<RoomResponse> GetRoomByNumberAsync(HttpClient client, string roomNumber)
    {
        var rooms = await GetRoomsAsync(client);
        return rooms.Single(room => string.Equals(room.RoomNumber, roomNumber, StringComparison.Ordinal));
    }

    private static async Task<List<UserResponse>> GetUsersAsync(HttpClient client) =>
        await client.GetFromJsonAsync<List<UserResponse>>("/api/users") ?? [];

    private static async Task<List<TariffResponse>> GetTariffsAsync(HttpClient client) =>
        await client.GetFromJsonAsync<List<TariffResponse>>("/api/directories/tariffs") ?? [];

    private static async Task<List<EDormitory.Application.Contracts.Payments.ChargeResponse>> GetChargesAsync(HttpClient client) =>
        await client.GetFromJsonAsync<List<EDormitory.Application.Contracts.Payments.ChargeResponse>>("/api/payments/charges") ?? [];

    private static async Task<NotificationFeedResponse> GetNotificationFeedAsync(HttpClient client)
    {
        var response = await client.GetAsync("/api/notifications");
        var body = await response.Content.ReadAsStringAsync();

        Assert.True(response.IsSuccessStatusCode, $"GET /api/notifications failed with {(int)response.StatusCode}: {body}");

        return System.Text.Json.JsonSerializer.Deserialize<NotificationFeedResponse>(
                   body,
                   new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web))
               ?? throw new InvalidOperationException("Notification feed response was empty.");
    }

    private static CreateUserRequest BuildStudentRequest(string suffix, Guid roomId) =>
        new(
            $"Тестовий Студент {suffix}",
            $"student-{suffix}@edormitory.local",
            $"+38099{Math.Abs(suffix.GetHashCode() % 10_000_000):0000000}",
            "Student",
            roomId,
            null);

    private sealed record ApiError(string Title, int Status, string Detail);
}
