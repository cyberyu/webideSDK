#include <strategy/API.h>

class MyApp : public tbricks::Strategy
{
public:
    MyApp(const tbricks::InitializationReason& reason, const tbricks::StrategyParameters& parameters) {}

protected:
    void HandleDeleteRequest() override {}
    void HandlePauseRequest() override {}
    void HandleRunRequest() override {}
    void HandleModifyRequest(const tbricks::StrategyModifier& modifier) override {}
    void HandleValidateRequest(tbricks::ValidationContext& context) override { context.SendReply(); }
};

DEFINE_STRATEGY_ENTRY(MyApp)
