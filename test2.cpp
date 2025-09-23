#include <strategy/API.h>
#include <strategy/Definitions.h>

using namespace tbricks;

class SimpleCalculation: public Pricing
{
public:
    SimpleCalculation(const PricingRequest & request)
    : Pricing(request)
    {
        RequestAndIVIDs IVIDs;
        request.GetIVIDs(IVIDs);
        Calculate(IVIDs, request.GetFullCalculatedValuesRequest());
        SnapshotDone();
    }

    void HandlePricingModifyRequest(const PricingModifyRequest & request) override
    {
        RequestAndIVIDs IVIDs;
        request.GetIVIDs(IVIDs);
        Calculate(IVIDs, request.GetFullCalculatedValuesRequest());
    }

private:
    typedef Hash<Uuid, InstrumentVenueIdentification> RequestAndIVIDs;

    void HandleDeleteRequest() override {}
    void HandleRunRequest() override {}
    void HandlePauseRequest() override {}
    void HandleModifyRequest(const StrategyModifier & modifier) override {}
    void HandleValidateRequest(ValidationContext &context) override {}

    void Calculate(RequestAndIVIDs & values, const CalculatedValuesRequestFull & request)
    {
        for (const auto & civ_it : request.GetColumns())
        {
            if( civ_it.GetColumnInfo().GetDefinition() == tbricks::calculated_values::FX_Score())
            {
                Double x;
                StrategyParameters parameters;
                civ_it.GetColumnInfo().GetParameters(parameters);
                parameters.GetParameter(strategy_parameters::X(), x);
                for (const auto & ivids_it : values)
                {
                    CalculatedValueIdentifier calc_id(ivids_it.first, civ_it.GetColumnId());
                    Double result;
                    if( x.Empty() )
                        result.SetError("Missing X parameter");
                    else
                        result = x * 2;
                    Update(calc_id, result);
                }
            }
            else
            {
                TBERROR("System asked for calculation which the plugin does not support!");
            }
        }
        Send();
    }
};

DEFINE_PRICING_ENTRY(SimpleCalculation)
