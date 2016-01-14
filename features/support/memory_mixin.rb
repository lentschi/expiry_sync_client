module CucumberExpirySyncHelpers
  module MemoryMixin
    attr_accessor :memory
    
    def memory
      @memory ||= Hash.new
    end
    
    def memorize(val, key)      
      if (val.is_a?(Hash))
        val = val.deep_dup
      end
      
      if key.is_a?(Array)
        key.each do |curKey|
          memory[curKey] = val
        end
        
        return val
      end
      
      memory[key] = val
    end
    
    def recall(key)
      memory.should have_key(key), "I don't know what you mean by '#{key}'"
      memory[key]
    end
    
    def forget(key)
      memory.should have_key(key), "I don't know what you mean by '#{key}'"
      memory.delete key
    end
  end
end