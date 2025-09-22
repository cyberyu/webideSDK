//****************************************************************************************
// Demo 1: Basic Tbricks Strategy Demo
//****************************************************************************************

#include <iostream>
#include <string>

class BasicStrategy
{
private:
    bool m_running;
    std::string m_name;

public:
    BasicStrategy(const std::string& name) : m_running(false), m_name(name)
    {
        std::cout << "🚀 DEMO 1: Basic Strategy '" << m_name << "' Created" << std::endl;
    }

    virtual ~BasicStrategy() 
    {
        std::cout << "� DEMO 1: Strategy '" << m_name << "' Destroyed" << std::endl;
    }

    void Start()
    {
        std::cout << "📋 DEMO 1: Starting strategy '" << m_name << "'..." << std::endl;
        m_running = true;
        
        ProcessLogic();
        
        std::cout << "✅ DEMO 1: Strategy '" << m_name << "' completed successfully!" << std::endl;
    }

    void Stop()
    {
        std::cout << "🛑 DEMO 1: Stopping strategy '" << m_name << "'" << std::endl;
        m_running = false;
    }

    bool IsRunning() const 
    { 
        return m_running; 
    }

private:
    void ProcessLogic()
    {
        std::cout << "🔄 DEMO 1: Processing strategy logic..." << std::endl;
        std::cout << "📊 DEMO 1: Analyzing market data..." << std::endl;
        std::cout << "💡 DEMO 1: Making trading decisions..." << std::endl;
        std::cout << "📈 DEMO 1: Strategy execution complete" << std::endl;
    }
};

int main()
{
    std::cout << "🎯 DEMO 1: Starting Basic Tbricks Strategy Demo" << std::endl;
    
    BasicStrategy strategy("TestStrategy1");
    
    std::cout << "Status: " << (strategy.IsRunning() ? "Running" : "Stopped") << std::endl;
    
    strategy.Start();
    
    std::cout << "Status: " << (strategy.IsRunning() ? "Running" : "Stopped") << std::endl;
    
    strategy.Stop();
    
    std::cout << "🏁 DEMO 1: Demo completed!" << std::endl;
    
    return 0;
}
